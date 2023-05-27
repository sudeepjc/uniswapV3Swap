const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
require('dotenv').config({ path: __dirname + '/.env' });
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ADDRESS_ZERO, Trade, Route, Pool, TickListDataProvider, Tick } = require("@uniswap/v3-sdk");
const { ethers } = require("hardhat");
const { Token } = require("@uniswap/sdk-core");
const poolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");


describe("MySwapContract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deploySwapFixture() {

    [signer] = await ethers.getSigners();

    // All are mainnet addresses, forking mainnet
    const UniswapFactory_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const UniswapRouter_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    const Quoter_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

    // const quoterInterface = new ethers.utils.Interface([
    //   "function quoteExactInput(bytes memory path, uint256 amountIn) returns (uint256 amountOut)",
    //   "function quoteExactInputSingle( address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) returns (uint256 amountOut)",
    //   "function quoteExactOutput(bytes memory path, uint256 amountOut) returns (uint256 amountIn)",
    //   "function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut,uint160 sqrtPriceLimitX96) returns (uint256 amountIn)"
    // ])

    // const poolInterface = new ethers.utils.Interface([
    //   "function fee() external view returns (uint24)",
    //   "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)"
    // ])

    // const quoterInstance = new ethers.Contract(Quoter_ADDRESS, quoterInterface, signer);

    const MySwapFactory = await ethers.getContractFactory("MySwapContract", signer);
    const mySwap = await MySwapFactory.deploy(UniswapRouter_ADDRESS, UniswapFactory_ADDRESS, Quoter_ADDRESS);

    return { mySwap };
  }

  describe("Swap for given token amount", function () {
    it("Should swap when a pool exists", async function () {
      const { mySwap } = await loadFixture(deploySwapFixture);

      const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET);

      const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
      const WETH9_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const fee = 3000;

      const poolAddress = await mySwap.computePoolAddress(DAI_ADDRESS, WETH9_ADDRESS, fee);
      
      expect(poolAddress).to.be.not.eq(ADDRESS_ZERO);

      const DaiWhaleSigner = await ethers.getImpersonatedSigner("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8");
      
      const amountIn = ethers.utils.parseEther("10000");
      
      const poolInstance = new ethers.Contract(poolAddress, poolArtifact.abi, provider);
      
      const poolState = await poolInstance.slot0();
      console.log(poolState);
      const poolLiquidity = await poolInstance.liquidity();
      console.log(poolLiquidity);
      const tickSpacing = await poolInstance.tickSpacing();
      console.log(tickSpacing);

      const { chainId } = await ethers.provider.getNetwork();
      console.log(chainId);

      const daiInstanceMeta = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", DAI_ADDRESS, provider);
      let decimals = await daiInstanceMeta.decimals();
      let symbol =await daiInstanceMeta.symbol();
      let description =await daiInstanceMeta.name();
      const token0 = new Token(1, daiInstanceMeta.address, decimals, symbol, description);
      
      const wethInstanceMeta = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WETH9_ADDRESS, provider);
      decimals = await wethInstanceMeta.decimals();
      symbol =await wethInstanceMeta.symbol();
      description =await wethInstanceMeta.name();
      const token1 = new Token(1, wethInstanceMeta.address, decimals, symbol, description);

      const nearestTick = Math.floor(poolState.tick / tickSpacing) * tickSpacing;

      const tickLowerIndex = nearestTick - (60 * 100);
      const tickUpperIndex = nearestTick + (60 * 100);

      const tickLowerData = await poolInstance.ticks(tickLowerIndex);
      const tickUpperData = await poolInstance.ticks(tickUpperIndex);

      const tickLower = new Tick({index: tickLowerIndex, liquidityGross: tickLowerData.liquidityGross, liquidityNet: tickLowerData.liquidityNet});
      const tickUpper = new Tick({index: tickUpperIndex, liquidityGross: tickUpperData.liquidityGross, liquidityNet: tickUpperData.liquidityNet})

      const tickListDataProvider = new TickListDataProvider([tickLower, tickUpper], tickSpacing );

      const pool = new Pool(token0, token1, fee, poolState.sqrtRatioX96, poolLiquidity, poolState.tick, tickListDataProvider);

      console.log(pool);

      // const route = new Route(
      //   [pool],
      //   token0,
      //   token1
      // )

      // console.log(route);
      
      
      const intitalWETHBalance = await wethInstanceMeta.balanceOf(DaiWhaleSigner.address);
      await daiInstanceMeta.connect(DaiWhaleSigner).approve(mySwap.address, amountIn);

      console.log(intitalWETHBalance);

      


      

      const minAmountOut = await Trade.exactIn(route, amountIn);
      console.log(minAmountOut);

      // await expect( mySwap.connect(DaiWhaleSigner).swapForGivenInputMultiHop(DAI_ADDRESS, amountIn, path, minAmountOut)).not.to.be.reverted;

      const newBalance = await wethInstanceMeta.balanceOf(DaiWhaleSigner.address);
      console.log(newBalance);
      expect(newBalance).to.be.gte(intitalWETHBalance);

    });
  });
});
