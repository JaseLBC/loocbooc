import type { Meta, StoryObj } from '@storybook/react';
import { Card, Heading, Text } from '@loocbooc/design-system';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Card>;

const content = (
  <div>
    <Heading level={4}>Card Title</Heading>
    <Text color="secondary" className="mt-2">
      Cards use elevation, not borders. They lift on hover when interactive.
    </Text>
  </div>
);

export const Default:   Story = { args: { children: content, elevation: 1 } };
export const Elevation2: Story = { args: { children: content, elevation: 2 } };
export const Elevation3: Story = { args: { children: content, elevation: 3 } };
export const Hoverable: Story = { args: { children: content, hoverable: true } };
export const Clickable: Story = { args: { children: content, hoverable: true, clickable: true } };
export const NoPadding: Story = {
  args: {
    noPadding: true,
    children: (
      <div>
        <div className="w-full h-40 bg-surface-2 rounded-t-lg" />
        <div className="p-4">
          <Heading level={5}>Full-bleed image card</Heading>
        </div>
      </div>
    ),
  },
};

export const AllElevations: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-4 p-8 bg-surface-2">
      {([0, 1, 2, 3] as const).map((e) => (
        <Card key={e} elevation={e}>
          <Text variant="label" color="secondary">Elevation {e}</Text>
          <Text className="mt-1">Card content here.</Text>
        </Card>
      ))}
    </div>
  ),
};
