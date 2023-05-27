// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const ethers = require("ethers");
require('dotenv').config({ path: __dirname + '/.env' });
const { abi: QuoterAbi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json');
const { abi: Quoter2Abi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json');
const { abi: poolAbi } = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");
const { ADDRESS_ZERO } = require("@uniswap/v3-sdk");

async function main() {

//   const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET);

  const UniswapFactory_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
  const UniswapRouter_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const Quoter_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const fee = 3000;

  [signer] = await hre.ethers.getSigners();

  const provider = signer;

  const MySwapFactory = await hre.ethers.getContractFactory("MySwapContract", signer);
  const mySwap = await MySwapFactory.deploy(UniswapRouter_ADDRESS, UniswapFactory_ADDRESS, Quoter_ADDRESS);
  
  const poolAddress = await mySwap.computePoolAddress(DAI_ADDRESS, WETH_ADDRESS, fee);
  
  if(poolAddress == ADDRESS_ZERO) {
    throw `Pool does not exist`;
  }

  const poolInstance = new ethers.Contract(poolAddress, poolAbi, provider);
  
  const poolState = await poolInstance.slot0();
  
  const amountIn = ethers.utils.parseEther("10000");

  const tokenIn = DAI_ADDRESS;
  const tokenOut = WETH_ADDRESS;

  const daiInstanceMeta = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", DAI_ADDRESS, signer);
  let decimalsIn = await daiInstanceMeta.decimals();
  let symbolIn =await daiInstanceMeta.symbol();
  let descriptionIn =await daiInstanceMeta.name();
  
  const wethInstanceMeta = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WETH_ADDRESS, signer);
  let decimalsOut = await wethInstanceMeta.decimals();
  let symbolOut =await wethInstanceMeta.symbol();
  let descriptionOut =await wethInstanceMeta.name();
  
  const quoterInstance = new ethers.Contract(Quoter_ADDRESS, QuoterAbi, provider);
  const amountOut = await quoterInstance.callStatic.quoteExactInputSingle(tokenIn,tokenOut,fee, amountIn,0);
  console.log(`Expected Amount Out: ${ethers.utils.formatUnits(amountOut.toString(), decimalsOut)}`);

  let minAmountOut = amountOut.mul(9).div(10);
  console.log(`Minimun Amount Out with 10% slippage: ${ethers.utils.formatUnits(minAmountOut.toString(), decimalsOut)}`);

  const DaiWhaleSigner = await hre.ethers.getImpersonatedSigner("0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8");

  const intitalWETHBalance = await wethInstanceMeta.balanceOf(DaiWhaleSigner.address);
  console.log(`Initial WETH Balance: ${ethers.utils.formatUnits(intitalWETHBalance.toString(), decimalsOut)}`);
  
  await daiInstanceMeta.connect(DaiWhaleSigner).approve(mySwap.address, amountIn);

  let swaptx = await mySwap.connect(DaiWhaleSigner).swapForGivenInput(tokenIn, amountIn, tokenOut, minAmountOut, fee); 

  const receipt = await swaptx.wait();

  const newWETHBalance = await wethInstanceMeta.balanceOf(DaiWhaleSigner.address);
  console.log(`New WETH Balance: ${ethers.utils.formatUnits(newWETHBalance.toString(), decimalsOut)}`);

  if(newWETHBalance.lte(intitalWETHBalance.add(minAmountOut))){
    throw "Swap Failed";
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
