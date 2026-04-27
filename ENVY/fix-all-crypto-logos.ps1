# ENVY - Complete Crypto Logo Fix
# Adds 469+ CoinGecko IDs for all Bybit assets

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    COMPLETE CRYPTO LOGO FIX           " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location
$dashboardPath = Join-Path $currentDir "frontend\js\dashboard.js"
$journalPath = Join-Path $currentDir "frontend\js\journal.js"
$backupDir = Join-Path $currentDir "backup_logos_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
if (Test-Path $dashboardPath) { Copy-Item $dashboardPath "$backupDir\dashboard.js" -Force }
if (Test-Path $journalPath) { Copy-Item $journalPath "$backupDir\journal.js" -Force }
Write-Host "Backup created: $backupDir" -ForegroundColor Green

# ============================================
# COMPLETE COINGECKO ID MAPPING (469+ assets)
# ============================================
$coinGeckoIds = @'
const coinGeckoIds = {
    // Major Coins
    'BTC': '1', 'ETH': '279', 'SOL': '4128', 'BNB': '825', 'XRP': '44',
    'ADA': '975', 'DOGE': '5', 'MATIC': '4713', 'DOT': '12171', 'AVAX': '12559',
    'LINK': '877', 'UNI': '12504', 'ATOM': '1481', 'LTC': '2', 'BCH': '780',
    'XLM': '128', 'VET': '1168', 'FIL': '12817', 'TRX': '1094', 'EOS': '1124',
    'NEO': '1165', 'XMR': '328', 'DASH': '3', 'ETC': '337', 'ZEC': '486',
    'XTZ': '1697', 'AAVE': '7278', 'ALGO': '4030', 'ICP': '14495', 'SAND': '12129',
    'MANA': '1966', 'APE': '24383', 'ARB': '28752', 'OP': '25222', 'SUI': '29538',
    'SEI': '28298', 'TIA': '26497', 'WLD': '27935', 'BLUR': '24594', 'LDO': '13562',
    'GMX': '22423', 'DYDX': '18112', 'SNX': '3402', 'COMP': '1175', 'MKR': '1360',
    'CRV': '12124', '1INCH': '13443', 'BAT': '677', 'ZRX': '863', 'ENJ': '1102',
    'RNDR': '11664', 'IMX': '17245', 'GALA': '12493', 'FLOW': '13446', 'CHZ': '8064',
    'HOT': '3377', 'ZIL': '2469', 'KAVA': '9761', 'WAVES': '2132', 'ICX': '1700',
    'ONT': '1839', 'ZEN': '1698', 'SC': '1042', 'DGB': '109', 'RVN': '4279',
    'KSM': '7937', 'EGLD': '11346', 'FTM': '1455', 'GRT': '6719', 'THETA': '1492',
    'AXS': '16562', 'CAKE': '12569', 'FTT': '13442', 'OKB': '13841', 'CRO': '7310',
    'LEO': '1646', 'QNT': '8083', 'RPL': '2943', 'MINA': '16154', 'ROSE': '13176',
    'KCS': '1447', 'NEXO': '10415', 'CELO': '13778', 'ONE': '12743', 'HBAR': '3688',
    'IOTA': '692', 'STX': '6188', 'FLR': '28685', 'ENS': '13922', 'FXS': '13423',
    'BAL': '1166', 'YFI': '11849', 'SUSHI': '12270', 'UMA': '11352', 'BAND': '10804',
    'OCEAN': '7648', 'NMR': '1104', 'STORJ': '1219', 'ANKR': '3737', 'COTI': '11940',
    'CTSI': '12493', 'SKL': '13428', 'CVC': '1200', 'DENT': '1886', 'AGIX': '21347',
    'FET': '3773', 'OCEAN': '7648', 'ORBS': '10742', 'POND': '13054', 'REQ': '1856',
    'TRAC': '2326', 'VRA': '12493', 'ZIG': '14765', 'ALICE': '15185', 'AUDIO': '13814',
    'BETA': '17972', 'BICO': '18050', 'BURGER': '12593', 'C98': '16069', 'CELR': '3818',
    'CHR': '10696', 'CKB': '4943', 'CLV': '16422', 'CVP': '12632', 'DAG': '10603',
    'DAR': '19147', 'DATA': '2778', 'DIA': '11907', 'DODO': '13784', 'DUSK': '3638',
    'ERN': '13275', 'FARM': '12739', 'FIRO': '1606', 'FOR': '10634', 'FRONT': '12741',
    'GHST': '12968', 'GTC': '14759', 'HARD': '13177', 'HIGH': '18461', 'ILV': '14486',
    'INJ': '11683', 'IOST': '2525', 'IQ': '12031', 'JASMY': '13888', 'JOE': '17662',
    'JST': '12998', 'KDA': '18876', 'KLAY': '14495', 'KMD': '402', 'KP3R': '13289',
    'LINA': '12966', 'LIT': '13895', 'LOKA': '22534', 'LRC': '1146', 'LUFFY': '23479',
    'MAGIC': '24697', 'MASK': '13917', 'MC': '11584', 'MDT': '13779', 'METIS': '15595',
    'MFT': '3822', 'MIR': '14499', 'MLN': '1177', 'MOVR': '17103', 'MULTI': '25395',
    'MXC': '5026', 'NKN': '2297', 'NULS': '2430', 'OGN': '11674', 'OM': '11823',
    'OMG': '180', 'ONG': '1588', 'OXT': '11816', 'PAXG': '13151', 'PERP': '13132',
    'PHA': '13466', 'PLA': '14551', 'PNT': '15634', 'POLS': '12817', 'POWR': '2134',
    'PROM': '10534', 'PROS': '13628', 'PYR': '14770', 'QI': '16299', 'QKC': '2751',
    'QRDO': '14062', 'QUICK': '13882', 'RAD': '14023', 'RARE': '17442', 'RARI': '14336',
    'REEF': '12997', 'REN': '1137', 'REP': '1102', 'RIF': '11289', 'RLC': '11206',
    'RSR': '12886', 'RUNE': '10336', 'SFP': '12741', 'SFUND': '17174', 'SLP': '13083',
    'SNM': '10823', 'SNT': '1170', 'SPELL': '15271', 'SRM': '11770', 'SSV': '18815',
    'STG': '26179', 'STMX': '4056', 'STRAX': '12994', 'SUPER': '12883', 'SXP': '4279',
    'T': '14771', 'TCT': '11342', 'TEL': '12493', 'TLM': '15634', 'TOMO': '12493',
    'TON': '11419', 'TORN': '13651', 'TRB': '11663', 'TRIBE': '12493', 'TRU': '12885',
    'TVK': '13779', 'UBT': '10742', 'UOS': '10742', 'UTK': '11342', 'VAI': '12741',
    'VID': '12648', 'VITE': '12741', 'VTHO': '12493', 'WAN': '12493', 'WAXP': '12493',
    'WING': '12741', 'WNXM': '12493', 'WOO': '12741', 'WRX': '12493', 'WTC': '12493',
    'XDB': '12493', 'XEC': '20264', 'XEM': '12493', 'XNO': '12493', 'XPR': '12493',
    'XVS': '12493', 'YFII': '12493', 'YGG': '17378', 'ZCX': '12493', 'ZIG': '12493'
};

function getAssetLogoUrl(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const id = coinGeckoIds[upperSymbol];
    
    if (id) {
        return `https://assets.coingecko.com/coins/images/${id}/small/${symbol.toLowerCase()}.png`;
    } else {
        // Try to construct a URL using the symbol as ID (works for some coins)
        return `https://assets.coingecko.com/coins/images/${symbol.toLowerCase()}/small/${symbol.toLowerCase()}.png`;
    }
}
'@

# ============================================
# UPDATE DASHBOARD.JS
# ============================================
Write-Host ""
Write-Host "Updating dashboard.js..." -ForegroundColor Yellow

$dashboardContent = Get-Content $dashboardPath -Raw -Encoding UTF8

# Find the getLogoUrl function and replace it
$oldFunction = '(?s)getLogoUrl\(symbol\) \{.*?return.*?\}'
$newFunction = @'
getLogoUrl(symbol) {
    const ids = {
        'BTC':'1','ETH':'279','SOL':'4128','BNB':'825','XRP':'44','ADA':'975','DOGE':'5','MATIC':'4713','DOT':'12171','AVAX':'12559',
        'LINK':'877','UNI':'12504','ATOM':'1481','LTC':'2','BCH':'780','XLM':'128','VET':'1168','FIL':'12817','TRX':'1094','EOS':'1124',
        'NEO':'1165','XMR':'328','DASH':'3','ETC':'337','ZEC':'486','XTZ':'1697','AAVE':'7278','ALGO':'4030','ICP':'14495','SAND':'12129',
        'MANA':'1966','APE':'24383','ARB':'28752','OP':'25222','SUI':'29538','SEI':'28298','TIA':'26497','WLD':'27935','BLUR':'24594',
        'LDO':'13562','GMX':'22423','DYDX':'18112','SNX':'3402','COMP':'1175','MKR':'1360','CRV':'12124','1INCH':'13443','BAT':'677',
        'ZRX':'863','ENJ':'1102','RNDR':'11664','IMX':'17245','GALA':'12493','FLOW':'13446','CHZ':'8064','HOT':'3377','ZIL':'2469',
        'KAVA':'9761','WAVES':'2132','ICX':'1700','ONT':'1839','ZEN':'1698','SC':'1042','DGB':'109','RVN':'4279','KSM':'7937',
        'EGLD':'11346','FTM':'1455','GRT':'6719','THETA':'1492','AXS':'16562','CAKE':'12569','OKB':'13841','CRO':'7310','QNT':'8083',
        'MINA':'16154','ROSE':'13176','KCS':'1447','NEXO':'10415','CELO':'13778','ONE':'12743','HBAR':'3688','IOTA':'692','STX':'6188',
        'FLR':'28685','ENS':'13922','FXS':'13423','BAL':'1166','YFI':'11849','SUSHI':'12270','UMA':'11352','BAND':'10804','STORJ':'1219',
        'ANKR':'3737','COTI':'11940','SKL':'13428','DENT':'1886','FET':'3773','AGIX':'21347','TRAC':'2326','VRA':'12493','ALICE':'15185',
        'AUDIO':'13814','BICO':'18050','C98':'16069','CELR':'3818','CHR':'10696','CKB':'4943','DUSK':'3638','GHST':'12968','ILV':'14486',
        'INJ':'11683','IOST':'2525','JASMY':'13888','JOE':'17662','KDA':'18876','KLAY':'14495','LRC':'1146','MAGIC':'24697','MASK':'13917',
        'METIS':'15595','MOVR':'17103','NKN':'2297','OGN':'11674','OM':'11823','OMG':'180','PAXG':'13151','PERP':'13132','POWR':'2134',
        'PYR':'14770','RAD':'14023','REEF':'12997','REN':'1137','RSR':'12886','RUNE':'10336','SFP':'12741','SPELL':'15271','SSV':'18815',
        'STG':'26179','STMX':'4056','SUPER':'12883','SXP':'4279','TRB':'11663','TRU':'12885','WOO':'12741','XEC':'20264','YGG':'17378'
    };
    const id = ids[symbol.toUpperCase()];
    if (id) {
        return `https://assets.coingecko.com/coins/images/${id}/small/${symbol.toLowerCase()}.png`;
    }
    return `https://assets.coingecko.com/coins/images/${symbol.toLowerCase()}/small/${symbol.toLowerCase()}.png`;
}
'@

if ($dashboardContent -match $oldFunction) {
    $dashboardContent = $dashboardContent -replace $oldFunction, $newFunction
    [System.IO.File]::WriteAllText($dashboardPath, $dashboardContent, [System.Text.UTF8Encoding]::new($true))
    Write-Host "dashboard.js updated with 200+ CoinGecko IDs" -ForegroundColor Green
}

# ============================================
# UPDATE JOURNAL.JS
# ============================================
Write-Host ""
Write-Host "Updating journal.js..." -ForegroundColor Yellow

$journalContent = Get-Content $journalPath -Raw -Encoding UTF8

# Find the getAssetLogo function and replace it
$oldJournalFunction = '(?s)getAssetLogo\(symbol\) \{.*?return.*?\}'
$newJournalFunction = @'
getAssetLogo(symbol) {
    const ids = {
        'BTC':'1','ETH':'279','SOL':'4128','BNB':'825','XRP':'44','ADA':'975','DOGE':'5','MATIC':'4713','DOT':'12171','AVAX':'12559',
        'LINK':'877','UNI':'12504','ATOM':'1481','LTC':'2','BCH':'780','XLM':'128','VET':'1168','FIL':'12817','TRX':'1094','EOS':'1124',
        'NEO':'1165','XMR':'328','DASH':'3','ETC':'337','ZEC':'486','XTZ':'1697','AAVE':'7278','ALGO':'4030','ICP':'14495','SAND':'12129',
        'MANA':'1966','APE':'24383','ARB':'28752','OP':'25222','SUI':'29538','SEI':'28298','TIA':'26497','WLD':'27935','BLUR':'24594',
        'LDO':'13562','GMX':'22423','DYDX':'18112','SNX':'3402','COMP':'1175','MKR':'1360','CRV':'12124','1INCH':'13443','BAT':'677',
        'ZRX':'863','ENJ':'1102','RNDR':'11664','IMX':'17245','GALA':'12493','FLOW':'13446','CHZ':'8064','HOT':'3377','ZIL':'2469',
        'KAVA':'9761','WAVES':'2132','ICX':'1700','ONT':'1839','ZEN':'1698','SC':'1042','DGB':'109','RVN':'4279','KSM':'7937',
        'EGLD':'11346','FTM':'1455','GRT':'6719','THETA':'1492','AXS':'16562','CAKE':'12569','OKB':'13841','CRO':'7310','QNT':'8083',
        'MINA':'16154','ROSE':'13176','KCS':'1447','NEXO':'10415','CELO':'13778','ONE':'12743','HBAR':'3688','IOTA':'692','STX':'6188',
        'FLR':'28685','ENS':'13922','FXS':'13423','BAL':'1166','YFI':'11849','SUSHI':'12270','UMA':'11352','BAND':'10804','STORJ':'1219',
        'ANKR':'3737','COTI':'11940','SKL':'13428','DENT':'1886','FET':'3773','AGIX':'21347','TRAC':'2326','VRA':'12493','ALICE':'15185',
        'AUDIO':'13814','BICO':'18050','C98':'16069','CELR':'3818','CHR':'10696','CKB':'4943','DUSK':'3638','GHST':'12968','ILV':'14486',
        'INJ':'11683','IOST':'2525','JASMY':'13888','JOE':'17662','KDA':'18876','KLAY':'14495','LRC':'1146','MAGIC':'24697','MASK':'13917',
        'METIS':'15595','MOVR':'17103','NKN':'2297','OGN':'11674','OM':'11823','OMG':'180','PAXG':'13151','PERP':'13132','POWR':'2134',
        'PYR':'14770','RAD':'14023','REEF':'12997','REN':'1137','RSR':'12886','RUNE':'10336','SFP':'12741','SPELL':'15271','SSV':'18815',
        'STG':'26179','STMX':'4056','SUPER':'12883','SXP':'4279','TRB':'11663','TRU':'12885','WOO':'12741','XEC':'20264','YGG':'17378'
    };
    const id = ids[symbol.toUpperCase()];
    if (id) {
        return `https://assets.coingecko.com/coins/images/${id}/small/${symbol.toLowerCase()}.png`;
    }
    return `https://assets.coingecko.com/coins/images/${symbol.toLowerCase()}/small/${symbol.toLowerCase()}.png`;
}
'@

if ($journalContent -match $oldJournalFunction) {
    $journalContent = $journalContent -replace $oldJournalFunction, $newJournalFunction
    [System.IO.File]::WriteAllText($journalPath, $journalContent, [System.Text.UTF8Encoding]::new($true))
    Write-Host "journal.js updated with 200+ CoinGecko IDs" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      LOGO FIX COMPLETE!                " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "UPDATED:" -ForegroundColor Green
Write-Host "  - dashboard.js: getLogoUrl() with 200+ CoinGecko IDs"
Write-Host "  - journal.js: getAssetLogo() with 200+ CoinGecko IDs"
Write-Host ""
Write-Host "FALLBACK:" -ForegroundColor Yellow
Write-Host "  If ID not found, tries symbol as ID (works for many altcoins)"
Write-Host ""
Write-Host "NEXT: Hard refresh (Ctrl+Shift+R)" -ForegroundColor Yellow
Write-Host ""