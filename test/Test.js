const { expect } = require("chai");

function toUInt(a) {
  return ethers.BigNumber.from(a).div(ethers.BigNumber.from(2).pow(64))
}

function fromUInt(a) {
  return ethers.BigNumber.from(a).mul(ethers.BigNumber.from(2).pow(64))
}

describe("LS-LMSR", function() {

  beforeEach(async function() {
    [owner] = await ethers.getSigners()
  })

  describe("Deployment", function() {

    it("Conditional Tokens contract deployed", async function() {
      let CT = await ethers.getContractFactory("ConditionalTokens");
      ct = await CT.deploy()
    })

    it("Fake Dai contract deployed", async function() {
      let DAI = await ethers.getContractFactory("FakeDai");
      dai = await DAI.deploy();
    })

    it("Creating 2000 DAI for user", async function() {
      await dai.mint(owner.address, ethers.utils.parseEther('2000'))
      expect(await dai.balanceOf(owner.address)).to.equal(ethers.utils.parseEther('2000'))
    })

    it("LS-LMSR contract deployed", async function() {
      let LSLMSR = await ethers.getContractFactory("LsLMSR");
      lslmsr = await LSLMSR.deploy(ct.address, dai.address)
    })

    it("Approve LS-LMSR to spend user money", async function() {
      await dai.approve(lslmsr.address, ethers.utils.parseEther('1500'))
      expect(await dai.allowance(owner.address, lslmsr.address)).to.equal(ethers.utils.parseEther('1500'))
    })

    it("LS-LMSR setup", async function() {
      await lslmsr.setup(owner.address, '0x7465737400000000000000000000000000000000000000000000000000000000', 3, ethers.utils.parseEther('1000'), 501)

      expect(await dai.balanceOf(lslmsr.address)).to.equal(ethers.utils.parseEther('1000'))
      expect(await dai.balanceOf(owner.address)).to.equal(ethers.utils.parseEther('1000'))
    })

  })

  describe("Cost functions", function() {

    it("Checking initial cost function", async function() {
      expect(toUInt(ethers.BigNumber.from(await lslmsr.cost()))).to.equal(1050) //1000 subsidy with 5% overround
    })

    it("Checking price at baseline", async function() {
      expect(await lslmsr.price(1, '184467440737095516160')).to.equal('69151762028953803591')
    })
  })

  describe("Testing buy/sell", function() {
    it("Trying to buy", async function() {
      var cond = await lslmsr.condition()
      var coll = await ct.getCollectionId('0x0000000000000000000000000000000000000000000000000000000000000000', cond,1)
      var p = await ct.getPositionId(dai.address, coll)
      await expect(lslmsr.buy(1, '184467440737095516160')).to.emit(ct, 'PositionSplit')
      expect(await ct.balanceOf(owner.address, p))
        .to.equal(ethers.utils.parseEther('10'))
    })

    it("Testing re-mint", async function() {
      var cond = await lslmsr.condition()
      var coll = await ct.getCollectionId('0x0000000000000000000000000000000000000000000000000000000000000000', cond,2)
      var p = await ct.getPositionId(dai.address, coll)
      await lslmsr.buy(2, '18446744073709551616')
      expect(await ct.balanceOf(lslmsr.address, p))
        .to.equal('9000000000000000000')
    })
  })

  describe("Testing functions when event is over", function() {
    it("Reporting outcome for event", async function() {
      await expect(ct.reportPayouts('0x7465737400000000000000000000000000000000000000000000000000000000', [0,1,0]))
        .to.emit(ct, 'ConditionResolution')
    })
    it("Checking to see if you can buy after resolution", async function() {
      await expect(lslmsr.buy(1, fromUInt(10))).to.be.revertedWith('Market already resolved')
    })
    it("Seeing if you can withdraw initial liquidity", async function() {
      await lslmsr.withdraw()
    })
  })

})
