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

export type DIAOJettonMinterConfig = {
    totalSupply: bigint;
    adminAddress: Address;
    content: Cell;
    jettonWalletCode: Cell;
    mintable: boolean;
};

export function diaoJettonMinterConfigToCell(config: DIAOJettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(config.totalSupply)
        .storeAddress(config.adminAddress)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .storeBit(config.mintable)
        .endCell();
}

export class DIAOJettonMinter implements Contract {
    abi: ContractABI = { name: 'DIAOJettonMinter' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DIAOJettonMinter(address);
    }

    static createFromConfig(config: DIAOJettonMinterConfig, code: Cell, workchain = 0) {
        const data = diaoJettonMinterConfigToCell(config);
        const init = { code, data };
        return new DIAOJettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendInitMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId?: bigint;
            initialCirculationAddress: Address;
            vestingControllerAddress: Address;
            initialCirculationTonAmount: bigint;
            vestingControllerTonAmount: bigint;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x5f616c6c, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.initialCirculationAddress)
                .storeAddress(opts.vestingControllerAddress)
                .storeCoins(opts.initialCirculationTonAmount)
                .storeCoins(opts.vestingControllerTonAmount)
                .endCell(),
        });
    }

    async sendChangeAdmin(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId?: bigint;
            newAdminAddress: Address;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x00000003, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.newAdminAddress)
                .endCell(),
        });
    }

    async sendChangeContent(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId?: bigint;
            newContent: Cell;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x00000004, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeRef(opts.newContent)
                .endCell(),
        });
    }

    async getJettonData(provider: ContractProvider) {
        const res = await provider.get('get_jetton_data', []);
        const totalSupply = res.stack.readBigNumber();
        const mintable = res.stack.readBoolean();
        const adminAddress = res.stack.readAddress();
        const content = res.stack.readCell();
        const walletCode = res.stack.readCell();
        return { totalSupply, mintable, adminAddress, content, walletCode };
    }

    async getWalletAddress(provider: ContractProvider, ownerAddress: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() }
        ]);
        return res.stack.readAddress();
    }
}
