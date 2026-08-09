export * from "./config/config-provider";
export * from "./locale/en-US";
// NEVER put "use client" in this barrel. With sideEffects:false + ESM the
// per-file directives tree-shake correctly, but a directive here would poison
// the entire library for React Server Components consumers.
export {
  Button,
  // The union, not only ButtonProps: that one declares `href?: undefined`, so a
  // consumer wrapper typed with it rejects the anchor form entirely.
  type AnyButtonProps,
  type ButtonProps,
  type ButtonShape,
  type ButtonSize,
  type ButtonType,
  type LinkButtonProps,
} from "./button/button";
export { Icon, type IconProps } from "./icon/icon";
export { Spinner, type SpinnerProps, type SpinnerVariant } from "./spinner/spinner";
export { Badge, type BadgeProps, type BadgeVariant } from "./badge/badge";
export { Card, type CardProps, type CardVariant } from "./card/card";
export { Divider, type DividerProps } from "./divider/divider";
export { Tag, type TagProps, type TagVariant, type TagColor } from "./tag/tag";
export { Alert, type AlertProps } from "./alert/alert";
export { Container, type ContainerProps, type ContainerMaxWidth } from "./layout/container";
export { Row, type RowProps, type RowJustify, type RowAlign } from "./layout/row";
export { Input, type InputProps } from "./input/input";
export { Textarea, type TextareaProps } from "./textarea/textarea";
export { Checkbox, type CheckboxProps } from "./toggle/checkbox";
export { Radio, RadioGroup, type RadioProps, type RadioGroupProps } from "./toggle/radio";
export { Switch, type SwitchProps } from "./toggle/switch";
export { Avatar, getInitials, type AvatarProps, type AvatarStatus } from "./avatar/avatar";
export { Progress, type ProgressProps, type ProgressVariant } from "./progress/progress";
export { Col, type ColProps, type ColSpan, type ColOffset } from "./layout/col";
export { Portal, type PortalProps } from "./portal/portal";
export { Modal, type ModalProps } from "./dialog/modal";
export { Drawer, type DrawerProps } from "./dialog/drawer";
export {
  Select,
  type SelectProps,
  type SelectOption,
  type SelectSize,
  type SelectStatus,
} from "./select/select";
export { Tabs, type TabsProps, type TabItem, type TabsType, type TabPosition } from "./tabs/tabs";
export { Collapse, type CollapseProps, type CollapseItem } from "./accordion/collapse";
export { Toaster, Notification, type ToasterProps, type NotificationProps } from "./toast/toaster";
export { Tooltip, type TooltipProps } from "./tooltip/tooltip";
export { Popover, type PopoverProps } from "./popover/popover";
export { Popconfirm, type PopconfirmProps } from "./popover/popconfirm";
export {
  Dropdown,
  type DropdownProps,
  type DropdownMenuProps,
  type DropdownMenuItem,
  type DropdownMenuDivider,
  type DropdownMenuEntry,
} from "./menu/dropdown";
// Named exports rather than `export *`: two star sources exporting one name
// makes it ambiguous, and TypeScript drops an ambiguous export from the barrel
// rather than erroring — so a type vanishes from the public API with a clean
// typecheck and a clean build.
export {
  useAnchored,
  type AnchoredOptions,
  type Anchored,
  type TriggerKind,
} from "./anchored/use-anchored";
export { Table, type TableProps } from "./table/table";
export { Flex, flexGap, type FlexProps, type FlexGap } from "./layout/flex";
export { Space, type SpaceProps, type SpaceSize, type SpaceAlign } from "./layout/space";
export {
  Splitter,
  SplitterPanel,
  type SplitterProps,
  type SplitterPanelProps,
  type SplitterLayout,
} from "./layout/splitter";
export {
  Skeleton,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonInput,
  SkeletonImage,
  SkeletonNode,
  type SkeletonProps,
  type SkeletonAvatarProps,
  type SkeletonTitleProps,
  type SkeletonParagraphProps,
  type SkeletonNodeProps,
  type SkeletonSize,
  type SkeletonShape,
} from "./skeleton/skeleton";
export {
  Empty,
  PRESENTED_IMAGE_DEFAULT,
  PRESENTED_IMAGE_SIMPLE,
  type EmptyProps,
} from "./empty/empty";
export { Result, type ResultProps, type ResultStatus } from "./result/result";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./navigation/breadcrumb";
export {
  Steps,
  type StepsProps,
  type StepItem,
  type StepStatus,
  type StepsSize,
} from "./navigation/steps";
export {
  Segmented,
  type SegmentedProps,
  type SegmentedOption,
  type SegmentedSize,
} from "./navigation/segmented";
export { Statistic, type StatisticProps } from "./data/statistic";
export {
  Descriptions,
  type DescriptionsProps,
  type DescriptionItem,
  type DescriptionsSize,
} from "./data/descriptions";
export { Pagination, type PaginationProps, type PaginationSize } from "./data/pagination";
export {
  List,
  ListItem,
  ListItemMeta,
  type ListProps,
  type ListItemProps,
  type ListItemMetaProps,
  type ListSize,
} from "./data/list";
export { Slider, type SliderProps, type SliderMark } from "./numeric/slider";
export { InputNumber, type InputNumberProps, type InputNumberSize } from "./numeric/input-number";
export { Rate, type RateProps } from "./numeric/rate";
export {
  Form,
  FormItem,
  FormList,
  type FormProps,
  type FormItemProps,
  type FormListProps,
  type FormListField,
  type FormListOperations,
  type FormLayout,
} from "./form/form";
export { useForm, joinPath, type FormInstance, type NamePath } from "./form/use-form";
// `DatePanel` is deliberately not re-exported. It is the shared internal
// between Calendar and DatePicker; nobody has asked for a headless panel, and
// an exported component is a contract.
export { Calendar, type CalendarProps, type DateRange, type DisabledDate } from "./date/calendar";
export { DatePicker, type DatePickerProps, type DatePickerSize } from "./date/date-picker";
export { RangePicker, type RangePickerProps, type DateRangeValue } from "./date/range-picker";
export { TimePicker, type TimePickerProps } from "./date/time-picker";
export { Watermark, type WatermarkProps } from "./watermark/watermark";
// Re-exported rather than left in core: `font` is a prop of a React component,
// so typing a variable that holds one must not send a consumer to a second
// package for the type.
export type { WatermarkFont } from "@crosskit-ui/core";
export { Tree, type TreeProps, type TreeNode } from "./tree/tree";
export { TreeSelect, type TreeSelectProps, type TreeSelectSize } from "./tree/tree-select";
export { Cascader, type CascaderProps, type CascaderSize } from "./cascader/cascader";
export {
  Upload,
  UploadDragger,
  type UploadProps,
  type UploadChangeInfo,
  type UploadRequestArgs,
  type UploadListType,
  type UploadFile,
} from "./upload/upload";
