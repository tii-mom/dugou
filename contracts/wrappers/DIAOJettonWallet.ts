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

export type DIAOJettonWalletConfig = {
    jettonBalance: bigint;
    ownerAddress: Address;
    minterAddress: Address;
};

export function diaoJettonWalletConfigToCell(config: DIAOJettonWalletConfig): Cell {
    return beginCell()
        .storeCoins(config.jettonBalance)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.minterAddress)
        .endCell();
}

export class DIAOJettonWallet implements Contract {
    abi: ContractABI = { name: 'DIAOJettonWallet' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DIAOJettonWallet(address);
    }

    static createFromConfig(config: DIAOJettonWalletConfig, code: Cell, workchain = 0) {
        const data = diaoJettonWalletConfigToCell(config);
        const init = { code, data };
        return new DIAOJettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            jettonAmount: bigint;
            toAddress: Address;
            responseAddress: Address;
            forwardTonAmount: bigint;
            forwardPayload?: Cell;
        }
    ) {
        const forwardPayloadBuilder = beginCell();
        if (opts.forwardPayload) {
            forwardPayloadBuilder.storeRef(opts.forwardPayload);
        }

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x0f8a7ea5, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.toAddress)
                .storeAddress(opts.responseAddress)
                .storeBit(false) // custom payload is null (represented by 1 bit = 0)
                .storeCoins(opts.forwardTonAmount)
                .storeBit(opts.forwardPayload ? true : false) // forward payload indicator (1 bit)
                .storeBuilder(forwardPayloadBuilder)
                .endCell(),
        });
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            jettonAmount: bigint;
            responseAddress: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x595f07bc, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.responseAddress)
                .storeBit(false) // custom payload is null (1 bit = 0)
                .endCell(),
        });
    }

    async getWalletData(provider: ContractProvider) {
        const res = await provider.get('get_wallet_data', []);
        const jettonBalance = res.stack.readBigNumber();
        const ownerAddress = res.stack.readAddress();
        const minterAddress = res.stack.readAddress();
        const jettonWalletCode = res.stack.readCell();
        return { jettonBalance, ownerAddress, minterAddress, jettonWalletCode };
    }
}
