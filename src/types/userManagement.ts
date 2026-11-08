export type UserRole = 'master_admin' | 'manager' | 'viewer' | 'custom';
export type MemberStatus = 'active' | 'inactive' | 'suspended' | 'revoked';

export interface WorkspaceMemberItem {
  id: string;
  uid: string;
  workspaceId: string;
  email: string;
  displayName: string;
  mobile?: string | null;
  role: UserRole;
  status: MemberStatus;
  permissions: Record<string, boolean>;
  permissionsVersion?: number;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface PermissionDefinition {
  key: string;
  labelBangla: string;
  descriptionBangla: string;
  isViewKey?: boolean;
  parentViewKey?: string;
}

export interface PermissionModule {
  id: string;
  titleBangla: string;
  icon: string;
  viewKey: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'home',
    titleBangla: 'হোম সারসংক্ষেপ (Home Summary)',
    icon: '🏠',
    viewKey: 'viewHomeSummary',
    permissions: [
      {
        key: 'viewHomeSummary',
        labelBangla: 'হোম ড্যাশবোর্ড ও আর্থিক সারসংক্ষেপ দেখা',
        descriptionBangla: 'মূল ড্যাশবোর্ডের মোট ভাড়া, মোট খরচ ও উদ্বৃত্ত দেখা যাবে',
        isViewKey: true,
      },
    ],
  },
  {
    id: 'properties',
    titleBangla: 'বিল্ডিং ও সম্পত্তি (Properties)',
    icon: '🏢',
    viewKey: 'viewProperties',
    permissions: [
      {
        key: 'viewProperties',
        labelBangla: 'সম্পত্তির তালিকা ও তথ্য দেখা',
        descriptionBangla: 'বিল্ডিং ও প্রপার্টির বিস্তারিত দেখার অনুমতি',
        isViewKey: true,
      },
      {
        key: 'createProperty',
        labelBangla: 'নতুন প্রপার্টি যোগ করা',
        descriptionBangla: 'নতুন বিল্ডিং বা প্রপার্টি তৈরি করার ক্ষমতা',
        parentViewKey: 'viewProperties',
      },
      {
        key: 'updateProperty',
        labelBangla: 'প্রপার্টি তথ্য পরিবর্তন করা',
        descriptionBangla: 'বিল্ডিংয়ের নাম বা তথ্য এডিট করার অনুমতি',
        parentViewKey: 'viewProperties',
      },
      {
        key: 'archiveProperty',
        labelBangla: 'প্রপার্টি সংরক্ষণাগারে পাঠানো (Archive)',
        descriptionBangla: 'প্রপার্টি আর্কাইভ বা নিষ্ক্রিয় করার অনুমতি',
        parentViewKey: 'viewProperties',
      },
    ],
  },
  {
    id: 'units',
    titleBangla: 'ফ্ল্যাট ও ইউনিট (Units)',
    icon: '🚪',
    viewKey: 'viewUnits',
    permissions: [
      {
        key: 'viewUnits',
        labelBangla: 'ইউনিট তালিকা দেখা',
        descriptionBangla: 'সকল ফ্ল্যাট ও দোকানের তালিকা দেখার অনুমতি',
        isViewKey: true,
      },
      {
        key: 'createUnit',
        labelBangla: 'নতুন ইউনিট যোগ করা',
        descriptionBangla: 'বিল্ডিংয়ে নতুন ফ্ল্যাট বা দোকান তৈরির ক্ষমতা',
        parentViewKey: 'viewUnits',
      },
      {
        key: 'updateUnit',
        labelBangla: 'ইউনিটের নাম/তথ্য পরিবর্তন',
        descriptionBangla: 'ফ্ল্যাট নম্বর বা ভাড়া পরিবর্তন করার ক্ষমতা',
        parentViewKey: 'viewUnits',
      },
      {
        key: 'archiveUnit',
        labelBangla: 'ইউনিট আর্কাইভ করা',
        descriptionBangla: 'ইউনিট নিষ্ক্রিয় বা আর্কাইভ করার অনুমতি',
        parentViewKey: 'viewUnits',
      },
    ],
  },
  {
    id: 'tenants',
    titleBangla: 'ভাড়াটিয়া ও চুক্তি (Tenants & Leases)',
    icon: '👥',
    viewKey: 'viewTenants',
    permissions: [
      {
        key: 'viewTenants',
        labelBangla: 'ভাড়াটিয়া তালিকা ও বিস্তারিত দেখা',
        descriptionBangla: 'সকল ভাড়াটিয়ার তথ্য ও চুক্তিপত্র দেখার অনুমতি',
        isViewKey: true,
      },
      {
        key: 'createTenant',
        labelBangla: 'নতুন ভাড়াটিয়া চুক্তি নিবন্ধন',
        descriptionBangla: 'নতুন ভাড়াটিয়া যোগ ও অ্যাডভান্স জমার এন্ট্রি',
        parentViewKey: 'viewTenants',
      },
      {
        key: 'updateTenant',
        labelBangla: 'ভাড়াটিয়া তথ্য পরিবর্তন',
        descriptionBangla: 'ভাড়াটিয়ার ফোন নম্বর বা তথ্য হালনাগাদ করা',
        parentViewKey: 'viewTenants',
      },
      {
        key: 'manageTenants',
        labelBangla: 'ভাড়াটিয়া প্রস্থান ও রিফান্ড পরিচালনা',
        descriptionBangla: 'ভাড়াটিয়া খালি করা ও সিকিউরিটি ফেরত ব্যবস্থাপনা',
        parentViewKey: 'viewTenants',
      },
    ],
  },
  {
    id: 'rent',
    titleBangla: 'ভাড়া ও রসিদ (Rent Collection)',
    icon: '💰',
    viewKey: 'viewRent',
    permissions: [
      {
        key: 'viewRent',
        labelBangla: 'ভাড়ার খাতা ও বকেয়া তালিকা দেখা',
        descriptionBangla: 'মাসিক ভাড়ার বিল ও বকেয়া স্ট্যাটাস দেখার অনুমতি',
        isViewKey: true,
      },
      {
        key: 'collectRent',
        labelBangla: 'ভাড়া আদায় ও পেমেন্ট রেকর্ড',
        descriptionBangla: 'ভাড়াটিয়ার কাছ থেকে প্রাপ্ত ভাড়া সিস্টেমে তোলা',
        parentViewKey: 'viewRent',
      },
      {
        key: 'manageRentReceipts',
        labelBangla: 'মানি রসিদ ও বিল জেনারেট করা',
        descriptionBangla: 'মাসিক বিল তৈরি ও ডিজিটাল রসিদ প্রিন্ট করার অনুমতি',
        parentViewKey: 'viewRent',
      },
    ],
  },
  {
    id: 'expenses',
    titleBangla: 'খরচের হিসাব (Expenses)',
    icon: '📝',
    viewKey: 'viewExpenses',
    permissions: [
      {
        key: 'viewExpenses',
        labelBangla: 'খরচের খাতা দেখা',
        descriptionBangla: 'বিল্ডিং রক্ষণাবেক্ষণ ও অন্যান্য খরচের হিসেব দেখা',
        isViewKey: true,
      },
      {
        key: 'addExpense',
        labelBangla: 'নতুন খরচ এন্ট্রি করা',
        descriptionBangla: 'বিদ্যুৎ বিল, মেরামত বা অন্যান্য খরচ রেকর্ড করা',
        parentViewKey: 'viewExpenses',
      },
      {
        key: 'updateExpense',
        labelBangla: 'খরচের এন্ট্রি পরিবর্তন করা',
        descriptionBangla: 'পূর্বে রেকর্ডকৃত খরচের বিবরণ বা পরিমাণ এডিট করা',
        parentViewKey: 'viewExpenses',
      },
      {
        key: 'reverseExpense',
        labelBangla: 'ভুল খরচ রিভার্স/বাতিল করা',
        descriptionBangla: 'অ্যাকাউন্টিং ভুল সংশোধনে খরচ রিভার্স করা',
        parentViewKey: 'viewExpenses',
      },
    ],
  },
  {
    id: 'accounts',
    titleBangla: 'খাতা ও পূর্ণ বিবরণ (Accounts Khata)',
    icon: '📊',
    viewKey: 'viewAccounts',
    permissions: [
      {
        key: 'viewAccounts',
        labelBangla: 'পারিবারিক খাতা ও ক্যাশ স্টেটমেন্ট দেখা',
        descriptionBangla: 'আয় ও ব্যয়ের সমন্বিত জমা-খরচ খাতা দেখার অনুমতি',
        isViewKey: true,
      },
    ],
  },
  {
    id: 'distribution',
    titleBangla: 'পারিবারিক বণ্টন (Family Distribution)',
    icon: '🤝',
    viewKey: 'viewFamilyDistribution',
    permissions: [
      {
        key: 'viewFamilyDistribution',
        labelBangla: 'মাসিক বণ্টন বিবরণী দেখা',
        descriptionBangla: 'ওয়ারিশ ও সুবিধাভোগীদের মাসিক ভাতার হিসেব দেখা',
        isViewKey: true,
      },
      {
        key: 'manageFamilyDistribution',
        labelBangla: 'বণ্টন পরিচালনা ও ভাতা পরিশোধ রেকর্ড',
        descriptionBangla: 'সুবিধাভোগী যোগ, স্পেশাল অ্যাডজাস্টমেন্ট ও পেমেন্ট তোলা',
        parentViewKey: 'viewFamilyDistribution',
      },
    ],
  },
  {
    id: 'reserve',
    titleBangla: 'জরুরি রিজার্ভ ফান্ড (Reserve Fund)',
    icon: '🛡️',
    viewKey: 'viewReserveFund',
    permissions: [
      {
        key: 'viewReserveFund',
        labelBangla: 'রিজার্ভ ফান্ডের ব্যালেন্স ও লেজার দেখা',
        descriptionBangla: 'বিল্ডিংয়ের সংরক্ষিত তহবিলের বর্তমান স্থিতি দেখা',
        isViewKey: true,
      },
      {
        key: 'manageReserveFund',
        labelBangla: 'রিজার্ভে উদ্বৃত্ত স্থানান্তর',
        descriptionBangla: 'মাসিক নিট উদ্বৃত্ত থেকে রিজার্ভ ফান্ডে টাকা যোগ করা',
        parentViewKey: 'viewReserveFund',
      },
      {
        key: 'withdrawFromReserve',
        labelBangla: 'রিজার্ভ ফান্ড থেকে জরুরি উত্তোলন',
        descriptionBangla: 'বিল্ডিং সংস্কারের জরুরি খরচে ফান্ড থেকে উত্তোলন',
        parentViewKey: 'viewReserveFund',
      },
    ],
  },
  {
    id: 'reports',
    titleBangla: 'রিপোর্ট ও বিশ্লেষণ (Reports)',
    icon: '📑',
    viewKey: 'viewReports',
    permissions: [
      {
        key: 'viewReports',
        labelBangla: 'আর্থিক রিপোর্ট ও বিশ্লেষণ দেখা',
        descriptionBangla: 'মাসিক ও বার্ষিক আয়-ব্যয় এবং দখলদারিত্ব রিপোর্ট দেখা',
        isViewKey: true,
      },
      {
        key: 'exportReports',
        labelBangla: 'রিপোর্ট এক্সপোর্ট ও প্রিন্ট করা',
        descriptionBangla: 'CSV, এক্সেল ও PDF আকারে রিপোর্ট ডাউনলোড করা',
        parentViewKey: 'viewReports',
      },
    ],
  },
  {
    id: 'settings',
    titleBangla: 'অ্যাপ সেটিংস (Settings)',
    icon: '⚙️',
    viewKey: 'manageAppSettings',
    permissions: [
      {
        key: 'manageAppSettings',
        labelBangla: 'অ্যাপ ও ডিসপ্লে সেটিংস নিয়ন্ত্রণ',
        descriptionBangla: 'হোম পেজের কার্ড ও ফিচার কাস্টমাইজ করার অনুমতি',
        isViewKey: true,
      },
    ],
  },
];

export const ROLE_PRESET_CONFIGS: Record<
  'manager' | 'viewer',
  { labelBangla: string; descriptionBangla: string; permissions: Record<string, boolean> }
> = {
  viewer: {
    labelBangla: 'দর্শক (Viewer)',
    descriptionBangla: 'শুধুমাত্র মূল ড্যাশবোর্ড, প্রপার্টি, ইউনিট, ভাড়াটিয়া, ভাড়া ও খরচের তথ্য দেখতে পারবেন (কোনো পরিবর্তন বা এন্ট্রি করতে পারবেন না)।',
    permissions: {
      viewHomeSummary: true,
      viewProperties: true,
      createProperty: false,
      updateProperty: false,
      archiveProperty: false,
      viewUnits: true,
      createUnit: false,
      updateUnit: false,
      archiveUnit: false,
      viewTenants: true,
      createTenant: false,
      updateTenant: false,
      manageTenants: false,
      viewRent: true,
      collectRent: false,
      manageRentReceipts: false,
      viewExpenses: true,
      addExpense: false,
      updateExpense: false,
      reverseExpense: false,
      viewAccounts: true,
      viewFamilyDistribution: false,
      manageFamilyDistribution: false,
      viewReserveFund: false,
      manageReserveFund: false,
      withdrawFromReserve: false,
      viewReports: false,
      exportReports: false,
      manageAppSettings: false,
      manageWorkspaceMembers: false,
    },
  },
  manager: {
    labelBangla: 'ম্যানেজার (Manager)',
    descriptionBangla: 'দৈনন্দিন অপারেশন পরিচালনা করতে পারবেন (ইউনিট, ভাড়াটিয়া, ভাড়া আদায়, রসিদ তৈরি, খরচ তোলা এবং রিপোর্ট দেখা)।',
    permissions: {
      viewHomeSummary: true,
      viewProperties: true,
      createProperty: false,
      updateProperty: false,
      archiveProperty: false,
      viewUnits: true,
      createUnit: true,
      updateUnit: true,
      archiveUnit: false,
      viewTenants: true,
      createTenant: true,
      updateTenant: true,
      manageTenants: true,
      viewRent: true,
      collectRent: true,
      manageRentReceipts: true,
      viewExpenses: true,
      addExpense: true,
      updateExpense: false,
      reverseExpense: false,
      viewAccounts: true,
      viewFamilyDistribution: false,
      manageFamilyDistribution: false,
      viewReserveFund: false,
      manageReserveFund: false,
      withdrawFromReserve: false,
      viewReports: true,
      exportReports: false,
      manageAppSettings: false,
      manageWorkspaceMembers: false,
    },
  },
};
