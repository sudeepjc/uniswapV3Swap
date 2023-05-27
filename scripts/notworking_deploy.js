// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const ethers = require("ethers");
require('dotenv').config({ path: __dirname + '/.env' });
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ADDRESS_ZERO, Trade, Route, Pool, TickListDataProvider, Tick, SwapQuoter } = require("@uniswap/v3-sdk");
const { Token, CurrencyAmount, TradeType } = require("@uniswap/sdk-core");
const poolArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");

async function main() {
  
  const UniswapFactory_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
  const UniswapRouter_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const Quoter_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const WETH9_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const fee = 3000;
  
  [signer] = await hre.ethers.getSigners();
  const MySwapFactory = await hre.ethers.getContractFactory("MySwapContract", signer);
  const mySwap = await MySwapFactory.deploy(UniswapRouter_ADDRESS, UniswapFactory_ADDRESS, Quoter_ADDRESS);
  
  const poolAddress = await mySwap.computePoolAddress(DAI_ADDRESS, WETH9_ADDRESS, fee);
  
  expect(poolAddress).to.be.not.eq(ADDRESS_ZERO);
  
  
  const amountIn = ethers.utils.parseEther("10000");
  
  const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET);
  const poolInstance = new ethers.Contract(poolAddress, poolArtifact.abi, provider);
  
  const poolState = await poolInstance.slot0();
  // console.log(poolState);
  const poolLiquidity = await poolInstance.liquidity();
  // console.log(poolLiquidity);
  const tickSpacing = await poolInstance.tickSpacing();
  // console.log(tickSpacing);
  
  const daiInstanceMeta = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", DAI_ADDRESS, signer);
  let decimals = await daiInstanceMeta.decimals();
  let symbol =await daiInstanceMeta.symbol();
  let description =await daiInstanceMeta.name();
  const token0 = new Token(1, daiInstanceMeta.address, decimals, symbol, description);
  
  const wethInstanceMeta = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WETH9_ADDRESS, signer);
  decimals = await wethInstanceMeta.decimals();
  symbol =await wethInstanceMeta.symbol();
  description =await wethInstanceMeta.name();
  const token1 = new Token(1, wethInstanceMeta.address, decimals, symbol, description);
  
  // const nearestTick = Math.floor(poolState.tick / tickSpacing) * tickSpacing;
  
  // const tickLowerIndex = nearestTick - (tickSpacing * 100);
  // const tickUpperIndex = nearestTick + (tickSpacing * 100);
  
  // const tickLowerData = await poolInstance.ticks(tickLowerIndex);
  // console.log(tickLowerData);
  // const tickUpperData = await poolInstance.ticks(tickUpperIndex);
  // console.log(tickUpperData);
  
  // const tickLower = new Tick({index: tickLowerIndex, liquidityGross: tickLowerData.liquidityGross, liquidityNet: tickLowerData.liquidityNet});
  // const tickUpper = new Tick({index: tickUpperIndex, liquidityGross: tickUpperData.liquidityGross, liquidityNet: tickUpperData.liquidityNet})

  // const tickListDataProvider = new TickListDataProvider([tickLower, tickUpper], tickSpacing );

  const pool = new Pool(token0, token1, fee, poolState.sqrtPriceX96, poolLiquidity, poolState.tick);
  
  // console.log(pool);
  
  const route = new Route(
      [pool],
      token0,
      token1
    );
    
  // console.log(route);

  const currenyAmountIn = CurrencyAmount.fromRawAmount(token0, amountIn);

  const { calldata } = SwapQuoter.quoteCallParameters(
    route,
    currenyAmountIn,
    TradeType.EXACT_INPUT,
    {
      useQuoterV2: true,
    }
  );

  const quoteCallReturnData = await provider.call({
    to: Quoter_ADDRESS,
    data: calldata,
  })

  const amountOut = ethers.utils.defaultAbiCoder.decode(['uint256'], quoteCallReturnData);

  const uncheckedTrade = Trade.createUncheckedTrade({
    route: route,
    inputAmount: currenyAmountIn,
    outputAmount: CurrencyAmount.fromRawAmount(
      token1,
      JSBI.BigInt(amountOut)
    ),
    tradeType: TraderType.EXACT_INPUT,
  });

  console.log(uncheckedTrade);

  // const minAmountOut = await Trade.exactIn(route, currenyAmountIn);
  // console.log(minAmountOut);
    
    
    // const DaiWhaleSigner = await ethers.getImpersonatedSigner("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8");
  //   const intitalWETHBalance = await wethInstanceMeta.balanceOf(DaiWhaleSigner.address);
  // await daiInstanceMeta.connect(DaiWhaleSigner).approve(mySwap.address, amountIn);

  // console.log(intitalWETHBalance);

  


  

  

  // // await expect( mySwap.connect(DaiWhaleSigner).swapForGivenInputMultiHop(DAI_ADDRESS, amountIn, path, minAmountOut)).not.to.be.reverted;

  // const newBalance = await wethInstanceMeta.balanceOf(DaiWhaleSigner.address);
  // console.log(newBalance);
  // expect(newBalance).to.be.gte(intitalWETHBalance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
