import type { MessageKey } from './index';

/**
 * English messages.
 *
 * Typed as `Record<MessageKey, string>` on purpose: a key added to `th.ts` and
 * forgotten here is a compile error, not a Thai string appearing mid-sentence
 * for an English reader.
 */
export const en: Record<MessageKey, string> = {
  // --- Shared ---------------------------------------------------------------
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.confirm': 'OK',
  'common.delete': 'Delete',
  'common.duplicate': 'Duplicate',
  'common.language': 'Language',
  'common.loading': 'Loading…',
  'common.rename': 'Rename',
  'common.retry': 'Try again',
  'common.save': 'Save',
  'common.unlimited': 'Unlimited',

  // --- Site header ----------------------------------------------------------
  'nav.account': 'Account',
  'nav.faq': 'FAQ',
  'nav.features': 'Features',
  'nav.howItWorks': 'How it works',
  'nav.login': 'Sign in',
  'nav.openMenu': 'Open menu',
  'nav.plans': 'Pricing',
  'nav.signUpFree': 'Start free',
  'nav.toWorkspace': 'Open workspace',
  'nav.tryNow': 'Try it now',
  'nav.windows': 'Windows app',

  // --- Site footer ----------------------------------------------------------
  'footer.account': 'Account',
  'footer.allFeatures': 'All features',
  'footer.fontLicence': 'Sarabun is used under the SIL Open Font License 1.1',
  'footer.login': 'Sign in',
  'footer.manageSubscription': 'Manage subscription',
  'footer.openCoreModel': 'The open-core model',
  'footer.openSource': 'Open source',
  'footer.plansAndPricing': 'Plans and pricing',
  'footer.product': 'Product',
  'footer.register': 'Create an account',
  'footer.rights': '© {year} MeDF. All rights reserved.',
  'footer.sourceOnGitHub': 'Source on GitHub',
  'footer.tagline':
    'MeDF is a PDF editor that works like a design tool — drag, drop, resize and arrange anything on the page, then export back to PDF with the original quality intact.',
  'footer.tryNoSignup': 'Try it now (no account needed)',
  'footer.windowsVersion': 'Windows version',

  // --- Sign in and sign up --------------------------------------------------
  'auth.displayName': 'Display name',
  'auth.email': 'Email',
  'auth.hasAccount': 'Already have an account?',
  'auth.hidePassword': 'Hide password',
  'auth.login': 'Sign in',
  'auth.namePlaceholder': 'Alex Taylor',
  'auth.needsAccount': 'No account yet?',
  'auth.networkError': 'Could not reach the server. Check your connection and try again.',
  'auth.password': 'Password',
  'auth.passwordHint': 'Mix letters and numbers to keep your documents safe.',
  'auth.passwordMinPlaceholder': 'At least 8 characters',
  'auth.register': 'Create a free account',
  'auth.registerShort': 'Sign up free',
  'auth.showPassword': 'Show password',
  'auth.unknownError': 'Something went wrong. Please try again.',

  // --- Page titles and site metadata ---------------------------------------
  'meta.account': 'My account',
  'meta.admin': 'Admin',
  'meta.billing': 'Subscription',
  'meta.description':
    'Upload a PDF, then drag text, images, signatures and shapes straight onto the page. Resize, arrange, and export back to PDF at the original quality.',
  'meta.documents': 'My documents',
  'meta.editor': 'Edit document',
  'meta.login': 'Sign in',
  'meta.notFound': 'Page not found',
  'meta.register': 'Create an account',
  'meta.title': 'MeDF — drag-and-drop PDF editing',

  // --- Error screens --------------------------------------------------------
  'error.appTitle': 'This page could not be opened',
  'error.appBody':
    'Your documents and saved work are safe. Try reloading, or go back to your documents.',
  'error.fatalBody': 'The page could not load. Please try again, or refresh your browser.',
  'error.fatalTitle': 'Something went wrong',
  'error.myDocuments': 'My documents',
  'error.notFoundBody':
    'The link may have changed, or this document may have been deleted. Try the home page or your document list.',
  'error.notFoundTitle': 'Page not found',
  'error.reference': 'Reference: {digest}',
  'error.toHome': 'Back to home',
  'error.unexpectedBody':
    'A temporary problem — everything you had saved is still there. Please try again.',
  'error.unexpectedTitle': 'Something unexpected happened',
};
