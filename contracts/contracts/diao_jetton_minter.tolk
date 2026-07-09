import "@stdlib/gas-payments"
import "diao_config"

// Error codes
const ERR_NOT_FROM_ADMIN = 73;
const ERR_UNAUTHORIZED_BURN = 74;
const ERR_NOT_ENOUGH_AMOUNT_TO_RESPOND = 75;
const ERR_MINTER_LOCKED = 76;
const ERR_INVALID_PAYLOAD = 77;

// Structs
struct MinterStorage {
    totalSupply: coins
    adminAddress: address
    content: cell
    jettonWalletCode: cell
    mintable: bool
}

fun MinterStorage.load() {
    return MinterStorage.fromCell(contract.getData())
}

fun MinterStorage.save(self) {
    contract.setData(self.toCell())
}

struct WalletStorageRef {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage = WalletStorageRef {
        jettonBalance: 0,
        ownerAddress,
        minterAddress
    };

    return {
        stateInit: {
            code: jettonWalletCode,
            data: emptyWalletStorage.toCell()
        }
    };
}

fun calcAddressOfJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(ownerAddress, minterAddress, jettonWalletCode);
    return jwDeployed.calculateAddress()
}

// Opcodes & Messages
struct (0x5f616c6c) InitMint {
    queryId: uint64
    initialCirculationAddress: address
    vestingControllerAddress: address
    initialCirculationTonAmount: coins
    vestingControllerTonAmount: coins
}

struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: uint64
    jettonAmount: coins
    burnInitiator: address
    sendExcessesTo: address?
}

struct (0x2c76b973) RequestWalletAddress {
    queryId: uint64
    ownerAddress: address
    includeOwnerAddress: bool
}

struct (0xd1735400) ResponseWalletAddress {
    queryId: uint64
    jettonWalletAddress: address?
    ownerAddress: Cell<address>?
}

struct (0x00000003) ChangeMinterAdmin {
    queryId: uint64
    newAdminAddress: address
}

struct (0x00000004) ChangeMinterContent {
    queryId: uint64
    newContent: cell
}

struct (0x178d4519) InternalTransferStep {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    sendExcessesTo: address?
    forwardTonAmount: coins
    forwardPayload: RemainingBitsAndRefs
}

struct (0xd53276db) ReturnExcessesBack {
    queryId: uint64
}

type AllowedMessageToMinter =
    | InitMint
    | BurnNotificationForMinter
    | RequestWalletAddress
    | ChangeMinterAdmin
    | ChangeMinterContent

fun onBouncedMessage(in: InMessageBounced) {
    // Standard bounced handler can be empty since we lock minting immediately,
    // but we can skip prefix.
    in.bouncedBody.skipBouncedPrefix();
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToMinter.fromSlice(in.body);

    match (msg) {
        InitMint => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            assert (storage.mintable) throw ERR_MINTER_LOCKED;

            // Mark minter as funded and lock minting forever
            storage.totalSupply = TOTAL_SUPPLY;
            storage.mintable = false;
            storage.save();

            val emptyPayload = beginCell().endCell().beginParse();

            // 1. Send 1B DIAO to initial circulation wallet
            val intTransferCirc = InternalTransferStep {
                queryId: msg.queryId,
                jettonAmount: INITIAL_UNLOCK,
                transferInitiator: null,
                sendExcessesTo: msg.initialCirculationAddress,
                forwardTonAmount: 0,
                forwardPayload: emptyPayload
            };

            val deployCircMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.initialCirculationAddress, contract.getAddress(), storage.jettonWalletCode),
                value: msg.initialCirculationTonAmount,
                body: intTransferCirc.toCell()
            });
            deployCircMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);

            // 2. Send 9B DIAO to Vesting Controller
            val intTransferVesting = InternalTransferStep {
                queryId: msg.queryId,
                jettonAmount: LOCKED_SUPPLY,
                transferInitiator: null,
                sendExcessesTo: msg.vestingControllerAddress,
                forwardTonAmount: ton("0.05"),
                forwardPayload: emptyPayload
            };

            val deployVestingMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.vestingControllerAddress, contract.getAddress(), storage.jettonWalletCode),
                value: msg.vestingControllerTonAmount,
                body: intTransferVesting.toCell()
            });
            deployVestingMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
        }

        BurnNotificationForMinter => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == calcAddressOfJettonWallet(msg.burnInitiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            assert (storage.totalSupply >= msg.jettonAmount) throw ERR_INVALID_PAYLOAD;
            storage.totalSupply -= msg.jettonAmount;
            storage.save();

            if (msg.sendExcessesTo == null) {
                return;
            }

            val excessesMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: msg.sendExcessesTo,
                value: 0,
                body: ReturnExcessesBack {
                    queryId: msg.queryId
                }
            });
            excessesMsg.send(SEND_MODE_IGNORE_ERRORS | SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        RequestWalletAddress => {
            // ~0.01 TON minimum for respond
            assert (in.valueCoins > ton("0.01") + ton("0.01")) throw ERR_NOT_ENOUGH_AMOUNT_TO_RESPOND;

            var respondOwnerAddress: Cell<address>? = msg.includeOwnerAddress
                ? msg.ownerAddress.toCell()
                : null;

            var walletAddress: address? = null;
            if (msg.ownerAddress.getWorkchain() == BASECHAIN) {
                var storage = lazy MinterStorage.load();
                walletAddress = calcAddressOfJettonWallet(msg.ownerAddress, contract.getAddress(), storage.jettonWalletCode);
            }

            val respondMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: in.senderAddress,
                value: 0,
                body: ResponseWalletAddress {
                    queryId: msg.queryId,
                    jettonWalletAddress: walletAddress,
                    ownerAddress: respondOwnerAddress,
                }
            });
            respondMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        ChangeMinterAdmin => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            storage.adminAddress = msg.newAdminAddress;
            storage.save();
        }

        ChangeMinterContent => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            storage.content = msg.newContent;
            storage.save();
        }
    }
}

struct JettonDataReply {
    totalSupply: coins
    mintable: bool
    adminAddress: address
    jettonContent: cell
    jettonWalletCode: cell
}

get fun get_jetton_data(): JettonDataReply {
    val storage = lazy MinterStorage.load();

    return JettonDataReply {
        totalSupply: storage.totalSupply,
        mintable: storage.mintable,
        adminAddress: storage.adminAddress,
        jettonContent: storage.content,
        jettonWalletCode: storage.jettonWalletCode
    };
}

get fun get_wallet_address(ownerAddress: address): address {
    val storage = lazy MinterStorage.load();
    return calcAddressOfJettonWallet(ownerAddress, contract.getAddress(), storage.jettonWalletCode);
}
