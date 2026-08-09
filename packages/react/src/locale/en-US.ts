/**
 * The default locale, and the shape every other pack implements.
 *
 * Deliberately small. Month names, weekday names, and all date and number
 * formatting come from `Intl` — see `@crosskit-ui/core`'s date engine — so what
 * remains is only the hard-coded UI strings, around forty of them. A pack is a
 * translation exercise, not a data-entry one.
 */

export interface Locale {
  /** BCP 47 tag, passed to `Intl` for anything date- or number-shaped. */
  tag: string;
  Modal: { okText: string; cancelText: string };
  Table: {
    emptyText: string;
    sortAscending: string;
    sortDescending: string;
    cancelSort: string;
    filter: string;
    selectAll: string;
    selectInvert: string;
  };
  Select: { notFound: string; placeholder: string };
  Empty: { description: string };
  InputNumber: { increase: string; decrease: string };
  DatePicker: {
    today: string;
    now: string;
    ok: string;
    placeholder: string;
    clear: string;
    start: string;
    end: string;
    selectTime: string;
  };
  Pagination: { previous: string; next: string; jumpTo: string; perPage: string };
  /**
   * `done` and `error` are what the hidden live region announces on settle, so
   * they are whole sentences about one file rather than button labels.
   */
  Upload: { uploading: string; remove: string; retry: string; error: string; done: string };
  Popconfirm: { okText: string; cancelText: string };
  /** Templates for the form engine's rule messages. `{label}` and friends are substituted. */
  Form: {
    required: string;
    type: string;
    len: string;
    min: string;
    max: string;
    minValue: string;
    maxValue: string;
    pattern: string;
  };
}

export const enUS: Locale = {
  tag: "en-US",
  Modal: { okText: "OK", cancelText: "Cancel" },
  Table: {
    emptyText: "No data",
    sortAscending: "Sort ascending",
    sortDescending: "Sort descending",
    cancelSort: "Cancel sort",
    filter: "Filter",
    selectAll: "Select all",
    selectInvert: "Invert selection",
  },
  Select: { notFound: "No results", placeholder: "Select" },
  Empty: { description: "No data" },
  InputNumber: { increase: "Increase", decrease: "Decrease" },
  DatePicker: {
    today: "Today",
    now: "Now",
    ok: "OK",
    placeholder: "Select date",
    clear: "Clear",
    start: "Start date",
    end: "End date",
    selectTime: "Select time",
  },
  Pagination: { previous: "Previous", next: "Next", jumpTo: "Go to", perPage: "per page" },
  Upload: {
    uploading: "Uploading…",
    remove: "Remove",
    retry: "Retry",
    error: "Upload failed",
    done: "uploaded",
  },
  Popconfirm: { okText: "Yes", cancelText: "No" },
  Form: {
    required: "{label} is required",
    type: "{label} must be a valid {type}",
    len: "{label} must be exactly {len} characters",
    min: "{label} must be at least {min} characters",
    max: "{label} must be at most {max} characters",
    minValue: "{label} must be at least {min}",
    maxValue: "{label} must be at most {max}",
    pattern: "{label} is not in the expected format",
  },
};

export const defaultLocale = enUS;
