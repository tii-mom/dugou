import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const VESTING_ADDRESS = 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot';

function targetPriceForRound(round: number) {
    if (!Number.isInteger(round) || round < 1 || round > 18) {
        throw new Error('Round must be an integer from 1 to 18');
    }
    return 10_000_000n * (1n << BigInt(round));
}

function parseCommandArgs() {
    const scriptIndex = process.argv.findIndex((arg) => arg.includes('operateMainnetDIAO'));
    return scriptIndex >= 0 ? process.argv.slice(scriptIndex + 1) : [];
}

export async function run(provider: NetworkProvider) {
    if (provider.network() !== 'mainnet') {
        throw new Error('operateMainnetDIAO must be run with --mainnet');
    }

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error('Sender address is not available. Connect the admin wallet.');
    }

    const vesting = provider.open(DIAOVestingController.createFromAddress(Address.parse(VESTING_ADDRESS)));
    const data = await vesting.getVestingData();
    if (!sender.address.equals(data.adminAddress)) {
        throw new Error(`Connected wallet ${sender.address.toString()} is not admin ${data.adminAddress.toString()}`);
    }

    const args = parseCommandArgs();
    const command = args[0] ?? await provider.ui().input('Command: withdraw-ton | admin | submit-price | execute-unlock');

    if (command === 'withdraw-ton') {
        const amountArg = args[1] ?? await provider.ui().input('Amount to withdraw, e.g. 100');
        const amount = toNano(amountArg);
        provider.ui().write(`Withdrawing ${amountArg} native coin to treasury ${data.treasuryAddress.toString()}`);
        await vesting.sendWithdrawTon(sender, {
            amount,
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write('Withdraw transaction sent. Confirm it in your wallet if prompted.');
        return;
    }

    if (command === 'admin') {
        const actionArg = args[1] ?? await provider.ui().input('Admin action: 1 close, 2 open, 3 pause, 4 unpause, 7 finalize');
        const action = Number(actionArg);
        if (!Number.isInteger(action) || action < 1 || action > 7) {
            throw new Error('Admin action must be an integer from 1 to 7');
        }
        if (action === 5 || action === 6) {
            throw new Error('Action 5/6 requires an address payload and is intentionally not exposed by this simple script.');
        }
        await vesting.sendAdminControl(sender, {
            action,
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write(`Admin action ${action} transaction sent. Confirm it in your wallet if prompted.`);
        return;
    }

    if (command === 'submit-price') {
        const roundArg = args[1] ?? await provider.ui().input('Round 1-18');
        const round = Number(roundArg);
        const price = args[2] ? BigInt(args[2]) : targetPriceForRound(round);
        await vesting.sendSubmitPrice(sender, {
            price,
            targetRound: round,
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write(`Submit price transaction sent for round ${round}. Confirm it in your wallet if prompted.`);
        return;
    }

    if (command === 'execute-unlock') {
        await vesting.sendExecuteUnlock(sender, {
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write('Execute unlock transaction sent. Confirm it in your wallet if prompted.');
        return;
    }

    throw new Error('Unknown command. Use withdraw-ton, admin, submit-price, or execute-unlock.');
}
