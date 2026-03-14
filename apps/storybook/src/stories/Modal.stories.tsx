import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal, Button, Text } from '@loocbooc/design-system';

const meta: Meta<typeof Modal> = {
  title: 'Layout/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Modal>;

function ModalDemo({ size }: { size?: 'sm' | 'md' | 'lg' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Confirm your backing"
        description="Review your order before it's placed."
        size={size ?? 'md'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>Confirm Backing</Button>
          </>
        }
      >
        <Text color="secondary">
          You're about to back this style for $45. Your size M has been selected based on your avatar measurements.
        </Text>
      </Modal>
    </div>
  );
}

export const Default: Story = { render: () => <ModalDemo /> };
export const Small:   Story = { render: () => <ModalDemo size="sm" /> };
export const Large:   Story = { render: () => <ModalDemo size="lg" /> };
