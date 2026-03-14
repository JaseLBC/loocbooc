import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@loocbooc/design-system';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    fullWidth: false,
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger', 'accent'] },
    size:    { control: 'select', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled:{ control: 'boolean' },
    fullWidth:{ control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost:     Story = { args: { variant: 'ghost' } };
export const Danger:    Story = { args: { variant: 'danger', children: 'Delete' } };
export const Accent:    Story = { args: { variant: 'accent', children: 'Back This Style' } };

export const Small:  Story = { args: { size: 'sm' } };
export const Large:  Story = { args: { size: 'lg' } };

export const Loading:  Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="accent">Accent</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6">
      <Button
        iconLeft={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        }
      >
        Add Item
      </Button>
      <Button
        variant="secondary"
        iconRight={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      >
        Next
      </Button>
    </div>
  ),
};
