import { getLocalDateString } from '../utils/dateUtils';

// Default business info
export const DEFAULT_BUSINESS_INFO = {
  name: 'My Business',
  address: '',
  phone: '',
  gstin: '',
  icon: ''
};

// Default receipt state
export const getDefaultReceipt = (billNo = 1) => ({
  billNo,
  date: getLocalDateString(),
  customerName: '',
  items: [],
  others: 0,
  roundOff: 0
});

// Default new stock entry
export const getDefaultNewEntry = () => ({
  name: '',
  purchasePrice: '',
  quantity: '',
  date: getLocalDateString(),
  productGroup: '',
  provider: ''
});

// Default new item for receipt
export const DEFAULT_NEW_ITEM = {
  name: '',
  qty: 1,
  rate: 0
};

// Default modal states
export const DEFAULT_DELETE_MODAL = {
  show: false,
  receiptId: null,
  entryId: null
};

export const DEFAULT_PRINT_PREVIEW_MODAL = {
  show: false,
  receipt: null
};

export const DEFAULT_MERGE_MODAL = {
  show: false,
  oldName: '',
  targetName: '',
  oldEntries: [],
  targetEntries: []
};

// Date filter options
export const DATE_FILTER_OPTIONS = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  CUSTOM: 'custom'
};
