import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@loocbooc/design-system';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    label: 'Email address',
    placeholder: 'you@example.com',
  },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default:    Story = {};
export const WithValue:  Story = { args: { defaultValue: 'hello@loocbooc.com' } };
export const WithError:  Story = { args: { error: 'That email isn\'t valid.' } };
export const WithHint:   Story = { args: { hint: 'We\'ll never share your email.' } };
export const Clearable:  Story = { args: { clearable: true, defaultValue: 'some value' } };
export const Disabled:   Story = { args: { disabled: true, defaultValue: 'disabled value' } };

export const WithLeftIcon: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search garments…',
    iconLeft: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    clearable: true,
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-6 max-w-md">
      <Input label="Default state" placeholder="Type something" />
      <Input label="With value" defaultValue="Hello world" />
      <Input label="With error" error="This field is required." />
      <Input label="With hint" hint="At least 8 characters." />
      <Input label="Disabled" disabled defaultValue="Can't touch this" />
    </div>
  ),
};
