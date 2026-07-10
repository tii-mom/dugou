import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type DIAOVestingControllerConfig = {
    adminAddress: Address;
    priceSourceAddress: Address;
    treasuryAddress: Address;
    officialReserveAddress: Address;
    teamAddress: Address;
    emergencyRescueAddress: Address;
    jettonMinterAddress: Address;
    jettonWalletCode: Cell;
    saleActive: boolean;
    saleFinalized: boolean;
    paused: boolean;
    totalPackagesSold: number;
    currentUnlockedRound: number;
    pendingRound: number;
    pendingSubmittedAt: number;
    reserveAlreadyClaimed: bigint;
    teamClaimedRound: number;
    funded: boolean;
    emergencyRescued: bigint;
};

export function diaoVestingControllerConfigToCell(config: DIAOVestingControllerConfig): Cell {
    const cell2 = beginCell()
        .storeAddress(config.officialReserveAddress)
        .storeAddress(config.teamAddress)
        .storeAddress(config.jettonMinterAddress)
        .endCell();

    const cell4 = beginCell()
        .storeAddress(config.emergencyRescueAddress)
        .endCell();

    const cell3 = beginCell()
        .storeRef(config.jettonWalletCode)
        .storeBit(config.saleActive)
        .storeBit(config.saleFinalized)
        .storeBit(config.paused)
        .storeUint(config.totalPackagesSold, 16)
        .storeUint(config.currentUnlockedRound, 8)
        .storeUint(config.pendingRound, 8)
        .storeUint(config.pendingSubmittedAt, 32)
        .storeBit(false) // userPackages is empty dict
        .storeCoins(config.reserveAlreadyClaimed)
        .storeUint(config.teamClaimedRound, 8)
        .storeBit(config.funded)
        .storeCoins(config.emergencyRescued)
        .storeBit(false) // pendingBuyerDiao is empty dict
        .storeCoins(0n) // pendingReserveDiao
        .storeCoins(0n) // pendingTeamDiao
        .storeBit(false) // pendingRescueDiao is empty dict
        .storeBit(false) // pendingTransfers is empty dict
        .storeUint(0, 64) // transferNonce
        .endCell();

    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.priceSourceAddress)
        .storeAddress(config.treasuryAddress)
        .storeRef(cell2)
        .storeRef(cell4)
        .storeRef(cell3)
        .endCell();
}

export class DIAOVestingController implements Contract {
    abi: ContractABI = { name: 'DIAOVestingController' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DIAOVestingController(address);
    }

    static createFromConfig(config: DIAOVestingControllerConfig, code: Cell, workchain = 0) {
        const data = diaoVestingControllerConfigToCell(config);
        const init = { code, data };
        return new DIAOVestingController(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendBuyPackage(
        provider: ContractProvider,
        via: Sender,
        opts: {
            packageCount: number;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x42555950, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeUint(opts.packageCount, 8)
                .endCell(),
        });
    }

    async sendClaimBuyer(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x434c6275, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendClaimReserve(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x434c7265, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendClaimTeam(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x434c746d, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendSubmitPrice(
        provider: ContractProvider,
        via: Sender,
        opts: {
            price: bigint;
            targetRound: number;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x53554250, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeUint(opts.price, 64)
                .storeUint(opts.targetRound, 8)
                .endCell(),
        });
    }

    async sendExecuteUnlock(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x4558554e, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        opts: {
            amount: bigint;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x5744544f, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendAdminControl(
        provider: ContractProvider,
        via: Sender,
        opts: {
            action: number;
            payload?: Cell;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        const bodyBuilder = beginCell()
            .storeUint(0x41444d43, 32)
            .storeUint(opts.queryId ?? 0, 64)
            .storeUint(opts.action, 8);

        if (opts.payload) {
            bodyBuilder.storeSlice(opts.payload.beginParse());
        }

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodyBuilder.endCell(),
        });
    }

    async sendEmergencyRescueDiao(
        provider: ContractProvider,
        via: Sender,
        opts: {
            recipient: Address;
            amount: bigint;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x45525351, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.recipient)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendRetryBuyerTransfer(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x52544255, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendRetryReserveTransfer(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x52545245, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendRetryTeamTransfer(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x52545445, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendRetryRescueTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: { recipient: Address; value: bigint, queryId?: bigint }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x52545253, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.recipient)
                .endCell(),
        });
    }

    async getVestingData(provider: ContractProvider) {
        const res = await provider.get('get_vesting_data', []);
        const adminAddress = res.stack.readAddress();
        const priceSourceAddress = res.stack.readAddress();
        const treasuryAddress = res.stack.readAddress();
        const officialReserveAddress = res.stack.readAddress();
        const teamAddress = res.stack.readAddress();
        const emergencyRescueAddress = res.stack.readAddress();
        const jettonMinterAddress = res.stack.readAddress();
        const saleActive = res.stack.readBoolean();
        const saleFinalized = res.stack.readBoolean();
        const paused = res.stack.readBoolean();
        const totalPackagesSold = Number(res.stack.readBigNumber());
        const currentUnlockedRound = Number(res.stack.readBigNumber());
        const pendingRound = Number(res.stack.readBigNumber());
        const pendingSubmittedAt = Number(res.stack.readBigNumber());
        const reserveAlreadyClaimed = res.stack.readBigNumber();
        const teamClaimedRound = Number(res.stack.readBigNumber());
        const funded = res.stack.readBoolean();
        const emergencyRescued = res.stack.readBigNumber();

        return {
            adminAddress,
            priceSourceAddress,
            treasuryAddress,
            officialReserveAddress,
            teamAddress,
            emergencyRescueAddress,
            jettonMinterAddress,
            saleActive,
            saleFinalized,
            paused,
            totalPackagesSold,
            currentUnlockedRound,
            pendingRound,
            pendingSubmittedAt,
            reserveAlreadyClaimed,
            teamClaimedRound,
            funded,
            emergencyRescued,
        };
    }

    async getUserPackages(provider: ContractProvider, userAddress: Address) {
        const res = await provider.get('get_user_packages', [
            { type: 'slice', cell: beginCell().storeAddress(userAddress).endCell() }
        ]);
        const packageCount = Number(res.stack.readBigNumber());
        const highestClaimedRound = Number(res.stack.readBigNumber());
        return { packageCount, highestClaimedRound };
    }

    async getVestingWalletAddress(provider: ContractProvider): Promise<Address> {
        const res = await provider.get('get_vesting_wallet_address', []);
        return res.stack.readAddress();
    }

    async getPendingBuyerDiao(provider: ContractProvider, userAddress: Address): Promise<bigint> {
        const res = await provider.get('get_pending_buyer_diao', [
            { type: 'slice', cell: beginCell().storeAddress(userAddress).endCell() }
        ]);
        return res.stack.readBigNumber();
    }

    async getPendingReserveDiao(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_pending_reserve_diao', []);
        return res.stack.readBigNumber();
    }

    async getPendingTeamDiao(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_pending_team_diao', []);
        return res.stack.readBigNumber();
    }

    async getPendingRescueDiao(provider: ContractProvider, recipient: Address): Promise<bigint> {
        const res = await provider.get('get_pending_rescue_diao', [
            { type: 'slice', cell: beginCell().storeAddress(recipient).endCell() }
        ]);
        return res.stack.readBigNumber();
    }

    async getPendingTransfer(
        provider: ContractProvider,
        queryId: bigint
    ): Promise<{ transferType: number; recipient: Address; amount: bigint }> {
        const res = await provider.get('get_pending_transfer', [
            { type: 'int', value: queryId }
        ]);
        const transferType = Number(res.stack.readBigNumber());
        const recipient = res.stack.readAddress();
        const amount = res.stack.readBigNumber();
        return { transferType, recipient, amount };
    }

    async getTransferNonce(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_transfer_nonce', []);
        return res.stack.readBigNumber();
    }
}
