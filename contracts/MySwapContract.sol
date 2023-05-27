// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";

contract MySwapContract {
    using Address for address;
    ISwapRouter public immutable swapRouter;
    IUniswapV3Factory public immutable swapFactory;
    IQuoterV2 public immutable quoter;

    constructor(address _swapRouter, address _swapFactory, address _quoter) {
        swapRouter = ISwapRouter(_swapRouter);
        swapFactory = IUniswapV3Factory(_swapFactory);
        quoter = IQuoterV2(_quoter);
    }

    function swapForGivenInput(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 minAmountOut,
        uint24 poolFee
    ) external returns (uint256 amountOut) {
        require(
            tokenIn != address(0) && tokenIn.isContract(),
            "invalid TokenIn"
        );
        require(
            tokenOut != address(0) && tokenOut.isContract(),
            "invalid TokenOut"
        );

        require(amountIn > 0, "Invalid Amount");

        // Transfer the Intokens to this contract
        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountIn
        );

        // Approve the router to the InTokens.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        address poolAddress = computePoolAddress(tokenIn, tokenOut, poolFee);

        require(poolAddress != address(0), "pool does not exist");

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0 // All my attempts to set this value failed
            });

        amountOut = swapRouter.exactInputSingle(params);
    }

    function swapForGivenOutput(
        address tokenIn,
        uint256 amountInMaximum,
        address tokenOut,
        uint256 amountOut,
        uint24 poolFee
    ) external returns (uint256 amountIn) {
        // Transfer the Intokens to this contract
        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountInMaximum
        );

        // In production, one should choose the maximum amount to spend based on price and slippage
        TransferHelper.safeApprove(
            tokenIn,
            address(swapRouter),
            amountInMaximum
        );

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
            .ExactOutputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        amountIn = swapRouter.exactOutputSingle(params);

        // return the balance amount of in tokens
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(tokenIn, address(swapRouter), 0);
            TransferHelper.safeTransfer(
                tokenIn,
                msg.sender,
                amountInMaximum - amountIn
            );
        }
    }

    function swapForGivenInputMultiHop(
        address tokenIn,
        uint256 amountIn,
        bytes memory path,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        require(
            tokenIn != address(0) && tokenIn.isContract(),
            "invalid TokenIn"
        );

        require(amountIn > 0, "Invalid Amount");

        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountIn
        );

        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: path,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut
            });

        amountOut = swapRouter.exactInput(params);
    }

    function swapExactOutputMultihop(
        address tokenIn,
        uint256 amountOut,
        uint256 amountInMaximum,
        bytes memory path
    ) external returns (uint256 amountIn) {
        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountInMaximum
        );
        TransferHelper.safeApprove(
            tokenIn,
            address(swapRouter),
            amountInMaximum
        );

        ISwapRouter.ExactOutputParams memory params = ISwapRouter
            .ExactOutputParams({
                path: path,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });

        amountIn = swapRouter.exactOutput(params);

        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(tokenIn, address(swapRouter), 0);
            TransferHelper.safeTransferFrom(
                tokenIn,
                address(this),
                msg.sender,
                amountInMaximum - amountIn
            );
        }
    }

    function computePoolAddress(
        address tokenIn,
        address tokenOut,
        uint24 poolFee
    ) public view returns (address pool) {
        return swapFactory.getPool(tokenIn, tokenOut, poolFee);
    }
}
