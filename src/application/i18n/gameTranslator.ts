import type { EconomyTransactionErrorCode } from '../../domain/economy/economyState.js';
import type { FarmingCommandErrorCode } from '../../domain/farming/farmingCommands.js';
import type { SupportedLanguage } from '../../domain/settings/playerSettings.js';
import type { TutorialStep } from '../../domain/tutorial/tutorialState.js';
import type {
  FarmLoopAction,
  FarmLoopFailureCode,
  FarmLoopTutorialAction,
} from '../farmLoop/farmLoopCoordinator.js';

const VI_STRINGS = Object.freeze({
  'app.farmName': 'Nông trại HH',
  'app.weatherSunny': 'Nắng đẹp',
  'common.close': 'Đóng',
  'common.save': 'Lưu cài đặt',
  'common.coins': 'Xu',
  'common.day': 'Ngày {day}',
  'common.quantity': 'Số lượng {quantity}',
  'hud.rootLabel': 'Giao diện HH Farm',
  'hud.brandEyebrow': 'NÔNG TRẠI',
  'hud.coins': 'Xu',
  'hud.energy': 'Năng lượng',
  'hud.inventory': 'Túi đồ',
  'hud.hotbar': 'Thanh công cụ',
  'hud.emptySlot': 'Ô trống',
  'hud.inventoryEyebrow': '12 Ô',
  'hud.inventoryTitle': 'Túi đồ nông trại',
  'hud.inventoryHint': 'Chạm vật phẩm để gán vào ô công cụ đang chọn.',
  'hud.closeInventory': 'Đóng túi đồ',
  'hud.inventorySlotEmpty': 'Ô túi đồ {slot}, trống',
  'hud.toolbarSlotEmpty': '{slot}. Ô trống',
  'hud.toolbarSlotItem': '{slot}. {item}, số lượng {quantity}',
  'hud.objective': 'MỤC TIÊU',
  'hud.defaultObjective': 'Xới 3 ô đất đầu tiên',
  'hud.defaultObjectiveHint': 'Chọn cuốc · tiến tới mảnh đất',
  'shop.toggle': 'Cửa hàng',
  'shop.eyebrow': 'CHỢ NÔNG TRẠI',
  'shop.title': 'Cửa hàng hạt giống',
  'shop.hint': 'Mua hạt giống và bán vật phẩm trong túi.',
  'shop.closeLabel': 'Đóng cửa hàng',
  'shop.buySection': 'Mua hạt giống',
  'shop.sellSection': 'Bán từ túi đồ',
  'shop.buy': 'Mua',
  'shop.sellOne': 'Bán 1',
  'shop.cannotSell': 'Không thể bán',
  'shop.receiveUnlock': 'Nhận {quantity} · Mở ngày {day}',
  'shop.owned': 'Đang có {quantity}',
  'shop.price': '{price} xu',
  'shop.disabled.insufficient_funds': 'Không đủ xu',
  'shop.disabled.inventory_full': 'Túi đồ đã đầy',
  'shop.disabled.offer_locked': 'Chưa mở khóa',
  'shop.disabled.progression_locked': 'Cần cấp {level}',
  'shop.buyAria': 'Mua {item}, số lượng {quantity}, giá {price} xu',
  'shop.disabledAria': '{item}: {reason}',
  'shop.sellAria': 'Bán một {item}, nhận {price} xu',
  'shop.cannotSellAria': '{item}: không thể bán',
  'shop.feedback.bought': 'Đã mua {item} · -{coins} xu',
  'shop.feedback.sold': 'Đã bán {item} · +{coins} xu',
  'farm.rootLabel': 'Vòng lặp nông trại hướng dẫn',
  'farm.eyebrow': 'HƯỚNG DẪN NÔNG TRẠI',
  'farm.skip': 'Bỏ qua',
  'farm.plotLabel': 'Ô đất hướng dẫn',
  'farm.initialFeedback': 'Chọn hành động được đánh dấu để bắt đầu.',
  'farm.recommendedAria': '{label}, bước được đề xuất',
  'farm.stat.seeds': 'Hạt: {quantity}',
  'farm.stat.produce': 'Củ cải: {quantity}',
  'farm.stat.coins': 'Xu: {coins}',
  'farm.load.loaded': 'Đã tiếp tục từ autosave gần nhất.',
  'farm.load.recovered': 'Đã phục hồi từ bản lưu an toàn trước đó.',
  'farm.load.failed': 'Không thể đọc bản lưu; đang dùng nông trại mới.',
  'farm.load.migrated': 'Bản lưu cũ đã được nâng cấp an toàn.',
  'farm.success.till': 'Đất đã được xới và lưu an toàn.',
  'farm.success.plant': 'Đã gieo một hạt củ cải.',
  'farm.success.water': 'Cây đã được tưới.',
  'farm.success.next_day': 'Ngày mới đã bắt đầu sau khi autosave hoàn tất.',
  'farm.success.harvest': 'Củ cải đã được thu hoạch vào túi đồ.',
  'farm.success.sell': 'Đã bán một củ cải và nhận xu.',
  'farm.success.skip_tutorial': 'Hướng dẫn đã được bỏ qua; nông trại không bị thay đổi.',
  'farm.success.shop_buy': 'Giao dịch cửa hàng đã được autosave.',
  'farm.success.shop_sell': 'Giao dịch cửa hàng đã được autosave.',
  'farm.success.bind_toolbar': 'Túi đồ và thanh công cụ đã được autosave.',
  'farm.success.select_toolbar': 'Túi đồ và thanh công cụ đã được autosave.',
  'farm.action.till': 'Xới đất',
  'farm.action.plant': 'Gieo củ cải',
  'farm.action.water': 'Tưới cây',
  'farm.action.next_day': 'Ngủ qua ngày',
  'farm.action.harvest': 'Thu hoạch',
  'farm.action.sell': 'Bán củ cải',
  'farm.action.skip_tutorial': 'Bỏ qua hướng dẫn',
  'farm.step.till.title': 'Xới ô đất được đánh dấu',
  'farm.step.till.hint': 'Bắt đầu bằng cách chuẩn bị đất trồng.',
  'farm.step.plant.title': 'Gieo một hạt củ cải',
  'farm.step.plant.hint': 'Hạt giống được lấy từ túi đồ thật.',
  'farm.step.water.title': 'Tưới cây trước khi ngủ',
  'farm.step.water.hint': 'Cây chỉ tăng trưởng qua ngày khi đã được tưới.',
  'farm.step.next_day.title': 'Ngủ qua ngày',
  'farm.step.next_day.hint': 'Tiến độ được autosave trước khi ngày mới được commit.',
  'farm.step.harvest.title': 'Thu hoạch củ cải đã chín',
  'farm.step.harvest.hint': 'Sản lượng sẽ được thêm nguyên tử vào túi đồ.',
  'farm.step.sell.title': 'Bán một củ cải',
  'farm.step.sell.hint': 'Wallet và inventory sẽ commit cùng một giao dịch.',
  'farm.step.completed.title': 'Vòng lặp nông trại đã hoàn thành',
  'farm.step.completed.hint': 'Bạn đã xới, gieo, tưới, thu hoạch và bán thành công.',
  'farm.free.title': 'Chế độ tự do',
  'farm.free.hint': 'Hướng dẫn đã được bỏ qua; starter farm state vẫn giữ nguyên.',
  'progress.level': 'Cấp {level}',
  'progress.xp': '{xp} XP',
  'progress.unlocked': 'Đã mở khóa',
  'progress.unlock.carrot': 'Đã mở khóa hạt cà rốt!',
  'progress.unlock.strawberry': 'Đã mở khóa hạt dâu tây!',
  'settings.toggle': 'Cài đặt',
  'settings.dialogLabel': 'Cài đặt HH Farm',
  'settings.eyebrow': 'TÙY CHỈNH',
  'settings.title': 'Cài đặt',
  'settings.hint': 'Âm thanh, khả năng tiếp cận và ngôn ngữ được lưu riêng khỏi nông trại.',
  'settings.language': 'Ngôn ngữ',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.music': 'Âm lượng nhạc',
  'settings.sfx': 'Âm lượng hiệu ứng',
  'settings.reducedMotion': 'Giảm chuyển động',
  'settings.reducedMotionHint': 'Tắt hiệu ứng nhấp nháy và chuyển động trang trí.',
  'settings.vibration': 'Rung phản hồi',
  'settings.vibrationHint': 'Dùng rung ngắn khi thiết bị hỗ trợ.',
  'settings.progression': 'Tiến độ nông trại',
  'settings.unlockedCrops': 'Hạt giống đã mở',
  'settings.saveFeedback': 'Cài đặt đã được lưu.',
  'settings.reloadFeedback': 'Đang tải lại để áp dụng ngôn ngữ…',
  'settings.loadRecovered': 'Cài đặt lỗi đã được phục hồi về mặc định.',
  'settings.loadUnavailable': 'Không thể lưu cài đặt trên trình duyệt này.',
  'settings.persistNote': 'Tạo nông trại mới không xóa các cài đặt này.',
  'crop.turnip': 'Củ cải',
  'crop.carrot': 'Cà rốt',
  'crop.strawberry': 'Dâu tây',
  'item.tool.hoe': 'Cuốc',
  'item.tool.watering-can': 'Bình tưới',
  'item.seed.turnip': 'Hạt củ cải',
  'item.seed.carrot': 'Hạt cà rốt',
  'item.seed.strawberry': 'Hạt dâu tây',
  'item.produce.turnip': 'Củ cải thu hoạch',
  'item.produce.carrot': 'Cà rốt thu hoạch',
  'item.produce.strawberry': 'Dâu tây thu hoạch',
  'failure.already_tilled': 'Ô đất này đã được xới.',
  'failure.already_watered': 'Ô đất này đã được tưới.',
  'failure.crop_not_mature': 'Cây chưa chín để thu hoạch.',
  'failure.invalid_day': 'Ngày trồng không hợp lệ.',
  'failure.invalid_target': 'Hãy chọn đúng ô đất.',
  'failure.inventory_full': 'Túi đồ không còn đủ chỗ.',
  'failure.no_crop': 'Ô đất chưa có cây.',
  'failure.no_seed': 'Bạn không còn hạt giống phù hợp.',
  'failure.soil_not_tilled': 'Hãy xới đất trước khi gieo.',
  'failure.tile_occupied': 'Ô đất đã có cây.',
  'failure.unknown_crop': 'Loại cây này chưa có trong nội dung game.',
  'failure.item_not_owned': 'Bạn không có đủ vật phẩm để bán.',
  'failure.item_not_sellable': 'Vật phẩm này không thể bán.',
  'failure.transaction_failed': 'Giao dịch không thể hoàn tất.',
  'failure.action_in_progress': 'Một hành động khác đang được lưu. Hãy thử lại.',
  'failure.crop_not_ready_for_day': 'Cây cần được tưới trước khi ngủ qua ngày.',
  'failure.save_failed': 'Không thể lưu tiến độ: {detail}',
  'load.unavailable': 'Không thể mở autosave: {detail}',
  'load.unrecoverable': 'Không thể phục hồi autosave: {detail}',
} as const);

export type GameStringKey = keyof typeof VI_STRINGS;

const EN_STRINGS: Readonly<Record<GameStringKey, string>> = Object.freeze({
  'app.farmName': 'HH Farm',
  'app.weatherSunny': 'Sunny',
  'common.close': 'Close',
  'common.save': 'Save settings',
  'common.coins': 'Coins',
  'common.day': 'Day {day}',
  'common.quantity': 'Quantity {quantity}',
  'hud.rootLabel': 'HH Farm interface',
  'hud.brandEyebrow': 'FARM',
  'hud.coins': 'Coins',
  'hud.energy': 'Energy',
  'hud.inventory': 'Inventory',
  'hud.hotbar': 'Toolbar',
  'hud.emptySlot': 'Empty slot',
  'hud.inventoryEyebrow': '12 SLOTS',
  'hud.inventoryTitle': 'Farm inventory',
  'hud.inventoryHint': 'Tap an item to bind it to the selected toolbar slot.',
  'hud.closeInventory': 'Close inventory',
  'hud.inventorySlotEmpty': 'Inventory slot {slot}, empty',
  'hud.toolbarSlotEmpty': '{slot}. Empty slot',
  'hud.toolbarSlotItem': '{slot}. {item}, quantity {quantity}',
  'hud.objective': 'OBJECTIVE',
  'hud.defaultObjective': 'Till the first 3 plots',
  'hud.defaultObjectiveHint': 'Select the hoe · walk to the soil',
  'shop.toggle': 'Shop',
  'shop.eyebrow': 'FARM MARKET',
  'shop.title': 'Seed shop',
  'shop.hint': 'Buy seeds and sell items from your inventory.',
  'shop.closeLabel': 'Close shop',
  'shop.buySection': 'Buy seeds',
  'shop.sellSection': 'Sell from inventory',
  'shop.buy': 'Buy',
  'shop.sellOne': 'Sell 1',
  'shop.cannotSell': 'Cannot sell',
  'shop.receiveUnlock': 'Receive {quantity} · Day {day}',
  'shop.owned': 'Owned: {quantity}',
  'shop.price': '{price} coins',
  'shop.disabled.insufficient_funds': 'Not enough coins',
  'shop.disabled.inventory_full': 'Inventory full',
  'shop.disabled.offer_locked': 'Locked',
  'shop.disabled.progression_locked': 'Requires level {level}',
  'shop.buyAria': 'Buy {item}, quantity {quantity}, price {price} coins',
  'shop.disabledAria': '{item}: {reason}',
  'shop.sellAria': 'Sell one {item} for {price} coins',
  'shop.cannotSellAria': '{item}: cannot sell',
  'shop.feedback.bought': 'Bought {item} · -{coins} coins',
  'shop.feedback.sold': 'Sold {item} · +{coins} coins',
  'farm.rootLabel': 'Guided farm loop',
  'farm.eyebrow': 'FARM TUTORIAL',
  'farm.skip': 'Skip',
  'farm.plotLabel': 'Tutorial plot',
  'farm.initialFeedback': 'Choose the highlighted action to begin.',
  'farm.recommendedAria': '{label}, recommended step',
  'farm.stat.seeds': 'Seeds: {quantity}',
  'farm.stat.produce': 'Turnips: {quantity}',
  'farm.stat.coins': 'Coins: {coins}',
  'farm.load.loaded': 'Continued from the latest autosave.',
  'farm.load.recovered': 'Recovered from the previous safe save.',
  'farm.load.failed': 'The save could not be read; using a new farm.',
  'farm.load.migrated': 'The older save was upgraded safely.',
  'farm.success.till': 'The soil was tilled and saved safely.',
  'farm.success.plant': 'Planted one turnip seed.',
  'farm.success.water': 'The crop was watered.',
  'farm.success.next_day': 'A new day started after autosave completed.',
  'farm.success.harvest': 'The turnip was harvested into inventory.',
  'farm.success.sell': 'Sold one turnip and received coins.',
  'farm.success.skip_tutorial': 'The tutorial was skipped without changing the farm.',
  'farm.success.shop_buy': 'The shop transaction was autosaved.',
  'farm.success.shop_sell': 'The shop transaction was autosaved.',
  'farm.success.bind_toolbar': 'Inventory and toolbar were autosaved.',
  'farm.success.select_toolbar': 'Inventory and toolbar were autosaved.',
  'farm.action.till': 'Till soil',
  'farm.action.plant': 'Plant turnip',
  'farm.action.water': 'Water crop',
  'farm.action.next_day': 'Sleep',
  'farm.action.harvest': 'Harvest',
  'farm.action.sell': 'Sell turnip',
  'farm.action.skip_tutorial': 'Skip tutorial',
  'farm.step.till.title': 'Till the highlighted plot',
  'farm.step.till.hint': 'Prepare the soil before planting.',
  'farm.step.plant.title': 'Plant one turnip seed',
  'farm.step.plant.hint': 'The seed comes from the real inventory.',
  'farm.step.water.title': 'Water the crop before sleeping',
  'farm.step.water.hint': 'Crops only grow overnight after being watered.',
  'farm.step.next_day.title': 'Sleep until tomorrow',
  'farm.step.next_day.hint': 'Progress is autosaved before the new day commits.',
  'farm.step.harvest.title': 'Harvest the mature turnip',
  'farm.step.harvest.hint': 'The complete yield is added atomically to inventory.',
  'farm.step.sell.title': 'Sell one turnip',
  'farm.step.sell.hint': 'Wallet and inventory commit in one transaction.',
  'farm.step.completed.title': 'Farm loop complete',
  'farm.step.completed.hint': 'You tilled, planted, watered, harvested and sold a crop.',
  'farm.free.title': 'Free play',
  'farm.free.hint': 'The tutorial was skipped; starter farm state stayed unchanged.',
  'progress.level': 'Level {level}',
  'progress.xp': '{xp} XP',
  'progress.unlocked': 'Unlocked',
  'progress.unlock.carrot': 'Carrot seeds unlocked!',
  'progress.unlock.strawberry': 'Strawberry seeds unlocked!',
  'settings.toggle': 'Settings',
  'settings.dialogLabel': 'HH Farm settings',
  'settings.eyebrow': 'PREFERENCES',
  'settings.title': 'Settings',
  'settings.hint': 'Audio, accessibility and language are stored separately from farm progress.',
  'settings.language': 'Language',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.music': 'Music volume',
  'settings.sfx': 'SFX volume',
  'settings.reducedMotion': 'Reduce motion',
  'settings.reducedMotionHint': 'Disable decorative motion and flashing effects.',
  'settings.vibration': 'Haptic feedback',
  'settings.vibrationHint': 'Use a short vibration when the device supports it.',
  'settings.progression': 'Farm progression',
  'settings.unlockedCrops': 'Unlocked seeds',
  'settings.saveFeedback': 'Settings saved.',
  'settings.reloadFeedback': 'Reloading to apply the language…',
  'settings.loadRecovered': 'Invalid settings were restored to defaults.',
  'settings.loadUnavailable': 'Settings cannot be stored in this browser.',
  'settings.persistNote': 'Starting a new farm does not erase these settings.',
  'crop.turnip': 'Turnip',
  'crop.carrot': 'Carrot',
  'crop.strawberry': 'Strawberry',
  'item.tool.hoe': 'Hoe',
  'item.tool.watering-can': 'Watering Can',
  'item.seed.turnip': 'Turnip Seeds',
  'item.seed.carrot': 'Carrot Seeds',
  'item.seed.strawberry': 'Strawberry Seeds',
  'item.produce.turnip': 'Turnip',
  'item.produce.carrot': 'Carrot',
  'item.produce.strawberry': 'Strawberry',
  'failure.already_tilled': 'This plot is already tilled.',
  'failure.already_watered': 'This plot is already watered.',
  'failure.crop_not_mature': 'The crop is not mature yet.',
  'failure.invalid_day': 'The planting day is invalid.',
  'failure.invalid_target': 'Choose a valid farm plot.',
  'failure.inventory_full': 'There is not enough inventory space.',
  'failure.no_crop': 'There is no crop on this plot.',
  'failure.no_seed': 'You do not have the required seed.',
  'failure.soil_not_tilled': 'Till the soil before planting.',
  'failure.tile_occupied': 'This plot already contains a crop.',
  'failure.unknown_crop': 'This crop is not available in the content catalog.',
  'failure.item_not_owned': 'You do not own enough items to sell.',
  'failure.item_not_sellable': 'This item cannot be sold.',
  'failure.transaction_failed': 'The transaction could not be completed.',
  'failure.action_in_progress': 'Another action is being saved. Try again.',
  'failure.crop_not_ready_for_day': 'Water the crop before sleeping.',
  'failure.save_failed': 'Progress could not be saved: {detail}',
  'load.unavailable': 'Autosave could not be opened: {detail}',
  'load.unrecoverable': 'Autosave could not be recovered: {detail}',
});

export type TranslationVariables = Readonly<
  Record<string, string | number>
>;

export type Translator = (
  key: GameStringKey,
  variables?: TranslationVariables,
) => string;

export function createTranslator(language: SupportedLanguage): Translator {
  const strings = language === 'en' ? EN_STRINGS : VI_STRINGS;
  return (key, variables = Object.freeze({})) =>
    strings[key].replace(
      /\{([a-zA-Z0-9_]+)\}/g,
      (placeholder: string, variableName: string) => {
        const value = variables[variableName];
        return value === undefined ? placeholder : String(value);
      },
    );
}

export function localeForLanguage(language: SupportedLanguage): string {
  return language === 'en' ? 'en-US' : 'vi-VN';
}

export function resolveItemLabel(
  language: SupportedLanguage,
  itemId: string,
  sourceName: string,
): string {
  const key = `item.${itemId}` as GameStringKey;
  const strings = language === 'en' ? EN_STRINGS : VI_STRINGS;
  return key in strings ? strings[key] : sourceName;
}

export function farmActionLabel(
  translate: Translator,
  action: FarmLoopTutorialAction,
): string {
  return translate(`farm.action.${action}` as GameStringKey);
}

export function farmStepCopy(
  translate: Translator,
  step: TutorialStep,
): Readonly<{ title: string; hint: string }> {
  return Object.freeze({
    title: translate(`farm.step.${step}.title` as GameStringKey),
    hint: translate(`farm.step.${step}.hint` as GameStringKey),
  });
}

export function farmSuccessCopy(
  translate: Translator,
  action: FarmLoopAction,
): string {
  return translate(`farm.success.${action}` as GameStringKey);
}

export function farmFailureCopy(
  translate: Translator,
  code: FarmLoopFailureCode,
  fallback: string,
): string {
  const key = `failure.${code}` as GameStringKey;
  return key in VI_STRINGS ? translate(key) : fallback;
}

export function economyFailureCopy(
  translate: Translator,
  code: EconomyTransactionErrorCode,
): string {
  if (code === 'insufficient_funds') {
    return translate('failure.transaction_failed');
  }
  if (code === 'inventory_full') {
    return translate('failure.inventory_full');
  }
  if (code === 'offer_locked') {
    return translate('shop.disabled.offer_locked');
  }
  if (code === 'item_not_owned') {
    return translate('failure.item_not_owned');
  }
  if (code === 'item_not_sellable') {
    return translate('failure.item_not_sellable');
  }
  return translate('failure.transaction_failed');
}

export function farmingFailureCopy(
  translate: Translator,
  code: FarmingCommandErrorCode,
): string {
  return translate(`failure.${code}` as GameStringKey);
}
