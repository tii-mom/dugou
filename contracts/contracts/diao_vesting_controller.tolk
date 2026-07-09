import "@stdlib/gas-payments"
import "diao_config"
import "@stdlib/tvm-dicts"

// Error codes
const ERR_NOT_FROM_ADMIN = 101;
const ERR_NOT_FROM_PRICE_ADMIN = 102;
const ERR_SALE_NOT_ACTIVE = 103;
const ERR_SALE_FINALIZED = 104;
const ERR_USER_LIMIT_EXCEEDED = 105;
const ERR_TOTAL_LIMIT_EXCEEDED = 106;
const ERR_INSUFFICIENT_PAYMENT = 107;
const ERR_NOT_FUNDED = 108;
const ERR_PAUSED = 109;
const ERR_COOLDOWN_NOT_MET = 110;
const ERR_PRICE_EXPIRED = 111;
const ERR_ROUND_ALREADY_UNLOCKED = 112;
const ERR_INVALID_ROUND = 113;
const ERR_PRICE_TOO_LOW = 114;
const ERR_NOT_FROM_OFFICIAL_RESERVE = 115;
const ERR_NOT_FROM_TEAM = 116;
const ERR_NOTHING_TO_CLAIM = 117;
const ERR_SALE_NOT_FINALIZED = 118;
const ERR_NOT_ENOUGH_TON = 119;
const ERR_INVALID_ADMIN_ACTION = 120;
const ERR_PENDING_ROUND_EXISTS = 121;
const ERR_INVALID_RESCUE_RECIPIENT = 122;
const ERR_RESCUE_AMOUNT_EXCEEDED = 123;
const ERR_INVALID_PAYLOAD = 77;

// Structs
struct UserPackageInfo {
    packageCount: uint8
    highestClaimedRound: uint8
}

struct VestingControllerStorage {
    adminAddress: address
    priceSourceAddress: address
    treasuryAddress: address
    officialReserveAddress: address
    teamAddress: address
    emergencyRescueAddress: address
    jettonMinterAddress: address
    jettonWalletCode: cell
    saleActive: bool
    saleFinalized: bool
    paused: bool
    totalPackagesSold: int
    currentUnlockedRound: int
    pendingRound: int
    pendingSubmittedAt: int
    userPackages: map<address, UserPackageInfo>
    reserveAlreadyClaimed: coins
    teamClaimedRound: int
    funded: bool
    emergencyRescued: coins
}

fun loadVestingStorage(): VestingControllerStorage {
    var ds = contract.getData().beginParse();
    val adminAddress = ds.loadAddress();
    val priceSourceAddress = ds.loadAddress();
    val treasuryAddress = ds.loadAddress();
    
    var ds2 = ds.loadRef().beginParse();
    val officialReserveAddress = ds2.loadAddress();
    val teamAddress = ds2.loadAddress();
    val jettonMinterAddress = ds2.loadAddress();
    ds2.assertEnd();

    var ds4 = ds.loadRef().beginParse();
    val emergencyRescueAddress = ds4.loadAddress();
    ds4.assertEnd();
    
    var ds3 = ds.loadRef().beginParse();
    val jettonWalletCode = ds3.loadRef();
    val saleActive = ds3.loadBool();
    val saleFinalized = ds3.loadBool();
    val paused = ds3.loadBool();
    val totalPackagesSold = ds3.loadUint(16);
    val currentUnlockedRound = ds3.loadUint(8);
    val pendingRound = ds3.loadUint(8);
    val pendingSubmittedAt = ds3.loadUint(32);
    val userPackages = ds3.loadDict();
    val reserveAlreadyClaimed = ds3.loadCoins();
    val teamClaimedRound = ds3.loadUint(8);
    val funded = ds3.loadBool();
    val emergencyRescued = ds3.loadCoins();
    ds3.assertEnd();
    
    ds.assertEnd();
    
    val typedMap = createMapFromLowLevelDict<address, UserPackageInfo>(userPackages);

    return VestingControllerStorage {
        adminAddress,
        priceSourceAddress,
        treasuryAddress,
        officialReserveAddress,
        teamAddress,
        emergencyRescueAddress,
        jettonMinterAddress,
        jettonWalletCode,
        saleActive,
        saleFinalized,
        paused,
        totalPackagesSold,
        currentUnlockedRound,
        pendingRound,
        pendingSubmittedAt,
        userPackages: typedMap,
        reserveAlreadyClaimed,
        teamClaimedRound,
        funded,
        emergencyRescued
    };
}

fun saveVestingStorage(s: VestingControllerStorage) {
    val rawDict = s.userPackages.toLowLevelDict();
    
    val cell2 = beginCell()
        .storeAddress(s.officialReserveAddress)
        .storeAddress(s.teamAddress)
        .storeAddress(s.jettonMinterAddress)
        .endCell();

    val cell4 = beginCell()
        .storeAddress(s.emergencyRescueAddress)
        .endCell();
        
    val cell3 = beginCell()
        .storeRef(s.jettonWalletCode)
        .storeBool(s.saleActive)
        .storeBool(s.saleFinalized)
        .storeBool(s.paused)
        .storeUint(s.totalPackagesSold, 16)
        .storeUint(s.currentUnlockedRound, 8)
        .storeUint(s.pendingRound, 8)
        .storeUint(s.pendingSubmittedAt, 32)
        .storeDict(rawDict)
        .storeCoins(s.reserveAlreadyClaimed)
        .storeUint(s.teamClaimedRound, 8)
        .storeBool(s.funded)
        .storeCoins(s.emergencyRescued)
        .endCell();

    var builder = beginCell()
        .storeAddress(s.adminAddress)
        .storeAddress(s.priceSourceAddress)
        .storeAddress(s.treasuryAddress)
        .storeRef(cell2)
        .storeRef(cell4)
        .storeRef(cell3);
        
    contract.setData(builder.endCell());
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
struct (0x42555950) BuyPackage {
    queryId: uint64
    packageCount: uint8
}

struct (0x434c6275) ClaimBuyer {
    queryId: uint64
}

struct (0x434c7265) ClaimReserve {
    queryId: uint64
}

struct (0x434c746d) ClaimTeam {
    queryId: uint64
}

struct (0x53554250) SubmitPrice {
    queryId: uint64
    price: uint64
    targetRound: uint8
}

struct (0x4558554e) ExecuteUnlock {
    queryId: uint64
}

struct (0x5744544f) WithdrawTon {
    queryId: uint64
    amount: coins
}

struct (0x41444d43) AdminControl {
    queryId: uint64
    action: uint8
    payload: RemainingBitsAndRefs
}

struct (0x45525351) EmergencyRescueDiao {
    queryId: uint64
    recipient: address
    amount: coins
}

// Jetton Messages
struct (0x0f8a7ea5) AskToTransfer {
    queryId: uint64
    jettonAmount: coins
    transferRecipient: address
    sendExcessesTo: address?
    customPayload: cell?
    forwardTonAmount: coins
    forwardPayload: RemainingBitsAndRefs
}

struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    forwardPayload: RemainingBitsAndRefs
}

struct (0xd53276db) ReturnExcessesBack {
    queryId: uint64
}

type AllowedMessageToVesting =
    | BuyPackage
    | ClaimBuyer
    | ClaimReserve
    | ClaimTeam
    | SubmitPrice
    | ExecuteUnlock
    | WithdrawTon
    | AdminControl
    | EmergencyRescueDiao
    | ReturnExcessesBack

fun sendJettonTransfer(
    jettonWalletAddress: address,
    queryId: int,
    jettonAmount: int,
    recipient: address,
    sendExcessesTo: address,
    tonAmount: int
) {
    val emptyPayload = beginCell().endCell().beginParse();

    val transferMsg = AskToTransfer {
        queryId,
        jettonAmount,
        transferRecipient: recipient,
        sendExcessesTo,
        customPayload: null,
        forwardTonAmount: 0,
        forwardPayload: emptyPayload
    };

    val msg = createMessage({
        bounce: BounceMode.Only256BitsOfBody,
        dest: jettonWalletAddress,
        value: tonAmount,
        body: transferMsg.toCell()
    });
    msg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun onBouncedMessage(in: InMessageBounced) {
    in.bouncedBody.skipBouncedPrefix();
}

fun isSenderVestingWallet(senderAddress: address): bool {
    var ds = contract.getData().beginParse();
    ds.loadAddress(); // adminAddress
    ds.loadAddress(); // priceSourceAddress
    ds.loadAddress(); // treasuryAddress
    
    var ds2 = ds.loadRef().beginParse();
    ds2.loadAddress(); // officialReserveAddress
    ds2.loadAddress(); // teamAddress
    val jettonMinterAddress = ds2.loadAddress();

    var ds4 = ds.loadRef().beginParse();
    ds4.loadAddress(); // emergencyRescueAddress
    ds4.assertEnd();
    
    var ds3 = ds.loadRef().beginParse();
    val jettonWalletCode = ds3.loadRef();
    
    val expectedWallet = calcAddressOfJettonWallet(contract.getAddress(), jettonMinterAddress, jettonWalletCode);
    return senderAddress == expectedWallet;
}

fun onInternalMessage(in: InMessage) {
    var body = in.body;
    if (body.remainingBitsCount() < 32) {
        return; // ignore empty/deploy messages
    }

    val op = body.preloadUint(32);
    if (op == 0x7362d09c) {
        body.skipBits(32);
        val queryId = body.loadUint(64);
        val jettonAmount = body.loadCoins();
        if (isSenderVestingWallet(in.senderAddress)) {
            if (jettonAmount == LOCKED_SUPPLY) {
                var storage = loadVestingStorage();
                storage.funded = true;
                saveVestingStorage(storage);
            }
        }
        return;
    }
    if (op == 0xd53276db) { // ReturnExcessesBack
        return;
    }

    handleAllowedMessage(in.senderAddress, in.valueCoins, in.body);
}

fun handleAllowedMessage(senderAddress: address, valueCoins: coins, body: slice) {
    val msg = lazy AllowedMessageToVesting.fromSlice(body);

    match (msg) {
        BuyPackage => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(storage.saleActive) throw ERR_SALE_NOT_ACTIVE;
            assert(!storage.saleFinalized) throw ERR_SALE_FINALIZED;
            assert(!storage.paused) throw ERR_PAUSED;

            val packageCount = msg.packageCount;
            assert((packageCount >= 1) & (packageCount <= 10)) throw ERR_INVALID_PAYLOAD;

            val userAddress = senderAddress;
            var currentPackages = 0;
            var highestClaimed = 0;

            var r = storage.userPackages.get(userAddress);
            if (r.isFound) {
                val info = r.loadValue();
                currentPackages = info.packageCount;
                highestClaimed = info.highestClaimedRound;
            }

            assert(currentPackages + packageCount <= MAX_PACKAGES_PER_WALLET) throw ERR_USER_LIMIT_EXCEEDED;
            assert(storage.totalPackagesSold + packageCount <= MAX_PACKAGES_TOTAL) throw ERR_TOTAL_LIMIT_EXCEEDED;

            // Verify TON payment: packageCount * 58 TON + 0.1 TON (gas for transfer)
            val requiredPayment = packageCount * PACKAGE_PRICE_TON + ton("0.1");
            assert(valueCoins >= requiredPayment) throw ERR_INSUFFICIENT_PAYMENT;

            // Update storage
            storage.userPackages.set(userAddress, UserPackageInfo {
                packageCount: currentPackages + packageCount,
                highestClaimedRound: highestClaimed
            });
            storage.totalPackagesSold += packageCount;

            // Check auto-finalize
            if (storage.totalPackagesSold == MAX_PACKAGES_TOTAL) {
                storage.saleFinalized = true;
                storage.saleActive = false;
            }

            saveVestingStorage(storage);

            // Immediate reward: packageCount * 200,000 DIAO
            val immediateAmount = packageCount * PACKAGE_IMMEDIATE;
            
            // Jetton Wallet address of this contract
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            // Excesses go to the buyer
            val tonToSend = valueCoins - (packageCount * PACKAGE_PRICE_TON);

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                immediateAmount,
                userAddress,
                userAddress,
                tonToSend
            );
        }

        ClaimBuyer => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(!storage.paused) throw ERR_PAUSED;

            val userAddress = senderAddress;
            var r = storage.userPackages.get(userAddress);
            assert(r.isFound) throw ERR_NOTHING_TO_CLAIM;

            val info = r.loadValue();
            val packageCount = info.packageCount;
            val highestClaimed = info.highestClaimedRound;

            val currentUnlocked = storage.currentUnlockedRound;
            val maxClaimableRound = min(currentUnlocked, MAX_BUYER_ROUNDS); // max round 15

            assert(maxClaimableRound > highestClaimed) throw ERR_NOTHING_TO_CLAIM;

            val claimableRounds = maxClaimableRound - highestClaimed;
            val claimAmount = claimableRounds * packageCount * BUYER_RELEASE_PER_ROUND;

            // Update user info
            storage.userPackages.set(userAddress, UserPackageInfo {
                packageCount: packageCount,
                highestClaimedRound: maxClaimableRound
            });
            saveVestingStorage(storage);

            // Send transfer
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                claimAmount,
                userAddress,
                userAddress,
                tonToSend
            );
        }

        ClaimReserve => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(storage.saleFinalized) throw ERR_SALE_NOT_FINALIZED;
            assert(!storage.paused) throw ERR_PAUSED;
            assert(senderAddress == storage.officialReserveAddress) throw ERR_NOT_FROM_OFFICIAL_RESERVE;

            val currentUnlocked = storage.currentUnlockedRound;
            val n = min(currentUnlocked, MAX_BUYER_ROUNDS); // rounds 1-15 only

            // official_reserve_total = 7.5B - total_packages_sold * 3.2M
            // Only from buyer+reserve pool (7.5B), NOT from team pool (1.5B)
            val soldAmount = storage.totalPackagesSold * PACKAGE_TOTAL;
            assert(soldAmount <= BUYER_AND_RESERVE_POOL) throw ERR_INVALID_PAYLOAD;
            val totalReservePool = BUYER_AND_RESERVE_POOL - soldAmount;
            
            // reserve_claimable_after_round_n = floor(official_reserve_total * n / 15)
            val totalClaimable = (totalReservePool * n) / MAX_BUYER_ROUNDS;
            val claimAmount = totalClaimable - storage.reserveAlreadyClaimed;

            assert(claimAmount > 0) throw ERR_NOTHING_TO_CLAIM;

            // Update storage
            storage.reserveAlreadyClaimed += claimAmount;
            saveVestingStorage(storage);

            // Send transfer
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                claimAmount,
                storage.officialReserveAddress,
                storage.officialReserveAddress,
                tonToSend
            );
        }

        ClaimTeam => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(!storage.paused) throw ERR_PAUSED;
            assert(senderAddress == storage.teamAddress) throw ERR_NOT_FROM_TEAM;

            val currentUnlocked = storage.currentUnlockedRound;
            assert(currentUnlocked >= 16) throw ERR_NOTHING_TO_CLAIM;

            val maxClaimableRound = min(currentUnlocked, TOTAL_ROUNDS); // max round 18
            val lastClaimed = storage.teamClaimedRound; // initially 15

            assert(maxClaimableRound > lastClaimed) throw ERR_NOTHING_TO_CLAIM;

            val claimableRounds = maxClaimableRound - lastClaimed;
            val claimAmount = claimableRounds * ROUND_ALLOCATION; // 500M per round

            // Update storage
            storage.teamClaimedRound = maxClaimableRound;
            saveVestingStorage(storage);

            // Send transfer
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                claimAmount,
                storage.teamAddress,
                storage.teamAddress,
                tonToSend
            );
        }

        SubmitPrice => {
            var storage = loadVestingStorage();
            assert(senderAddress == storage.priceSourceAddress) throw ERR_NOT_FROM_PRICE_ADMIN;
            assert(!storage.paused) throw ERR_PAUSED;
            assert(storage.pendingRound == 0) throw ERR_PENDING_ROUND_EXISTS;

            val targetRound = msg.targetRound;
            assert(targetRound == storage.currentUnlockedRound + 1) throw ERR_INVALID_ROUND;
            assert(targetRound <= TOTAL_ROUNDS) throw ERR_INVALID_ROUND;

            val targetPrice = INITIAL_PRICE_SCALED * (1 << targetRound);
            assert(msg.price >= targetPrice) throw ERR_PRICE_TOO_LOW;

            // Set pending
            storage.pendingRound = targetRound;
            storage.pendingSubmittedAt = blockchain.now();
            saveVestingStorage(storage);
        }

        ExecuteUnlock => {
            var storage = loadVestingStorage();
            assert(!storage.paused) throw ERR_PAUSED;

            val targetRound = storage.pendingRound;
            assert(targetRound == storage.currentUnlockedRound + 1) throw ERR_INVALID_ROUND;
            assert(targetRound <= TOTAL_ROUNDS) throw ERR_INVALID_ROUND;

            val currentTime = blockchain.now();
            assert(currentTime >= storage.pendingSubmittedAt + MANUAL_PRICE_COOLDOWN) throw ERR_COOLDOWN_NOT_MET;
            assert(currentTime <= storage.pendingSubmittedAt + MANUAL_PRICE_VALIDITY) throw ERR_PRICE_EXPIRED;

            // Execute unlock
            storage.currentUnlockedRound = targetRound;
            storage.pendingRound = 0;
            storage.pendingSubmittedAt = 0;
            saveVestingStorage(storage);
        }

        WithdrawTon => {
            var storage = loadVestingStorage();
            assert(senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;

            val amount = msg.amount;
            val balance = contract.getOriginalBalance();
            
            assert(amount + MIN_CONTROLLER_TON_RESERVE <= balance) throw ERR_NOT_ENOUGH_TON;

            val withdrawMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: storage.treasuryAddress,
                value: amount,
                body: ReturnExcessesBack {
                    queryId: msg.queryId
                }
            });
            withdrawMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
        }

        AdminControl => {
            var storage = loadVestingStorage();
            assert (senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            
            val action = msg.action;
            var ps = msg.payload as slice;
            
            if (action == 1) { // close sale
                assert(!storage.saleFinalized) throw ERR_SALE_FINALIZED;
                storage.saleActive = false;
            } else if (action == 2) { // open sale
                assert(!storage.saleFinalized) throw ERR_SALE_FINALIZED;
                storage.saleActive = true;
            } else if (action == 3) { // pause
                storage.paused = true;
            } else if (action == 4) { // unpause
                storage.paused = false;
            } else if (action == 5) { // update price admin
                assert(ps.remainingBitsCount() >= 267) throw ERR_INVALID_PAYLOAD;
                val newPriceAdmin = ps.loadAddress();
                storage.priceSourceAddress = newPriceAdmin;
            } else if (action == 7) { // finalize sale
                storage.saleFinalized = true;
                storage.saleActive = false;
            } else {
                assert(false) throw ERR_INVALID_ADMIN_ACTION;
            }
            saveVestingStorage(storage);
        }

        EmergencyRescueDiao => {
            var storage = loadVestingStorage();
            assert(senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(storage.paused) throw ERR_PAUSED;
            assert(msg.recipient == storage.emergencyRescueAddress) throw ERR_INVALID_RESCUE_RECIPIENT;

            val soldAmount = storage.totalPackagesSold * PACKAGE_TOTAL;
            assert(soldAmount <= BUYER_AND_RESERVE_POOL) throw ERR_INVALID_PAYLOAD;
            val reserveRemaining = BUYER_AND_RESERVE_POOL - soldAmount - storage.reserveAlreadyClaimed;
            val claimedTeamRounds = storage.teamClaimedRound - MAX_BUYER_ROUNDS;
            val teamClaimedAmount = claimedTeamRounds * ROUND_ALLOCATION;
            val teamRemaining = TEAM_TOTAL - teamClaimedAmount;
            val rescueable = reserveRemaining + teamRemaining - storage.emergencyRescued;

            assert(msg.amount > 0) throw ERR_NOTHING_TO_CLAIM;
            assert(msg.amount <= rescueable) throw ERR_RESCUE_AMOUNT_EXCEEDED;

            storage.emergencyRescued += msg.amount;
            saveVestingStorage(storage);

            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                msg.amount,
                msg.recipient,
                msg.recipient,
                tonToSend
            );
        }

        ReturnExcessesBack => {
            // Ignore excesses
        }
    }
}

struct VestingDataReply {
    adminAddress: address
    priceSourceAddress: address
    treasuryAddress: address
    officialReserveAddress: address
    teamAddress: address
    emergencyRescueAddress: address
    jettonMinterAddress: address
    saleActive: bool
    saleFinalized: bool
    paused: bool
    totalPackagesSold: int
    currentUnlockedRound: int
    pendingRound: int
    pendingSubmittedAt: int
    reserveAlreadyClaimed: coins
    teamClaimedRound: int
    funded: bool
    emergencyRescued: coins
}

get fun get_vesting_data(): VestingDataReply {
    val storage = loadVestingStorage();

    return VestingDataReply {
        adminAddress: storage.adminAddress,
        priceSourceAddress: storage.priceSourceAddress,
        treasuryAddress: storage.treasuryAddress,
        officialReserveAddress: storage.officialReserveAddress,
        teamAddress: storage.teamAddress,
        emergencyRescueAddress: storage.emergencyRescueAddress,
        jettonMinterAddress: storage.jettonMinterAddress,
        saleActive: storage.saleActive,
        saleFinalized: storage.saleFinalized,
        paused: storage.paused,
        totalPackagesSold: storage.totalPackagesSold,
        currentUnlockedRound: storage.currentUnlockedRound,
        pendingRound: storage.pendingRound,
        pendingSubmittedAt: storage.pendingSubmittedAt,
        reserveAlreadyClaimed: storage.reserveAlreadyClaimed,
        teamClaimedRound: storage.teamClaimedRound,
        funded: storage.funded,
        emergencyRescued: storage.emergencyRescued
    };
}

get fun get_user_packages(userAddress: address): UserPackageInfo {
    var storage = loadVestingStorage();
    var r = storage.userPackages.get(userAddress);
    if (r.isFound) {
        return r.loadValue();
    }
    return UserPackageInfo { packageCount: 0, highestClaimedRound: 0 };
}

get fun get_vesting_wallet_address(): address {
    var storage = loadVestingStorage();
    return calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
}
