import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@loocbooc/design-system';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Badge', variant: 'neutral' },
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'error', 'info', 'neutral', 'accent'] },
    size: { control: 'select', options: ['sm', 'md'] },
    dot: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-6">
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="accent">Back It</Badge>
    </div>
  ),
};

export const WithDots: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-6">
      <Badge variant="success" dot>Active</Badge>
      <Badge variant="warning" dot>Pending</Badge>
      <Badge variant="error" dot>Failed</Badge>
      <Badge variant="neutral" dot>Draft</Badge>
    </div>
  ),
};
