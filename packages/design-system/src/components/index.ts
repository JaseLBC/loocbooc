// ─── Primitives ───────────────────────────────────────────────
export { Button } from './primitives/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './primitives/Button';

export { Input } from './primitives/Input';
export type { InputProps } from './primitives/Input';

export { Select } from './primitives/Select';
export type { SelectProps, SelectOption } from './primitives/Select';

export { Checkbox } from './primitives/Checkbox';
export type { CheckboxProps } from './primitives/Checkbox';

export { Toggle } from './primitives/Toggle';
export type { ToggleProps } from './primitives/Toggle';

export { Badge } from './primitives/Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './primitives/Badge';

// ─── Layout ───────────────────────────────────────────────────
export { Card } from './layout/Card';
export type { CardProps, CardElevation } from './layout/Card';

export { Modal } from './layout/Modal';
export type { ModalProps } from './layout/Modal';

export { BottomSheet } from './layout/BottomSheet';
export type { BottomSheetProps } from './layout/BottomSheet';

export { Skeleton, SkeletonCard, SkeletonGarmentCard } from './layout/Skeleton';
export type { SkeletonProps } from './layout/Skeleton';

// ─── Navigation ───────────────────────────────────────────────
export { Tabs, TabList, Tab, TabPanel } from './navigation/Tabs';
export type { TabsProps, TabListProps, TabProps, TabPanelProps } from './navigation/Tabs';

export { Breadcrumb } from './navigation/Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItem } from './navigation/Breadcrumb';

export {
  Sidebar, SidebarToggle, SidebarSection, SidebarItem, useSidebar
} from './navigation/Sidebar';
export type { SidebarProps, SidebarSectionProps, SidebarItemProps } from './navigation/Sidebar';

// ─── Data ─────────────────────────────────────────────────────
export { ProgressBar } from './data/ProgressBar';
export type { ProgressBarProps, ProgressBarVariant, ProgressBarSize } from './data/ProgressBar';

export { DataTable } from './data/DataTable';
export type { DataTableProps, DataTableColumn, SortDirection } from './data/DataTable';

export { EmptyState } from './data/EmptyState';
export type { EmptyStateProps, EmptyStateVariant } from './data/EmptyState';

export { ErrorState } from './data/ErrorState';
export type { ErrorStateProps, ErrorStateVariant } from './data/ErrorState';

// ─── Fashion-specific ─────────────────────────────────────────
export { GarmentCard } from './fashion/GarmentCard';
export type { GarmentCardProps } from './fashion/GarmentCard';

export { SizeSelector } from './fashion/SizeSelector';
export type { SizeSelectorProps, SizeOption } from './fashion/SizeSelector';

export { CampaignProgressBar } from './fashion/CampaignProgressBar';
export type { CampaignProgressBarProps } from './fashion/CampaignProgressBar';

export { AvatarPlaceholder } from './fashion/AvatarPlaceholder';
export type { AvatarPlaceholderProps } from './fashion/AvatarPlaceholder';

export { PLMStageIndicator } from './fashion/PLMStageIndicator';
export type {
  PLMStageIndicatorProps, PLMStage, PLMStageStatus
} from './fashion/PLMStageIndicator';

// ─── Typography ───────────────────────────────────────────────
export { Heading } from './typography/Heading';
export type { HeadingProps, HeadingLevel, HeadingFont } from './typography/Heading';

export { Text } from './typography/Text';
export type { TextProps, TextVariant, TextColor } from './typography/Text';

export { Code } from './typography/Code';
export type { CodeProps, CodeVariant } from './typography/Code';
