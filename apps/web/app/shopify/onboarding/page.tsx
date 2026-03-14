/**
 * Brand onboarding flow — embedded in Shopify Admin via App Bridge.
 *
 * Steps:
 *   1. Confirm connected Shopify store
 *   2. Create (or link) a Brand record in Loocbooc
 *   3. Configure Back It settings (deposit %, currency, MOQ defaults)
 *   4. Redirect to the campaign dashboard
 *
 * This page uses Shopify Polaris for styling so it feels native inside
 * Shopify Admin. App Bridge provides the authenticated fetch helper.
 */

"use client";

import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  TextField,
  Select,
  Banner,
  ProgressBar,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useLoaderData, useActionData, Form } from "@remix-run/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoaderData {
  shop: string;
  shopName: string;
  existingBrandId: string | null;
}

interface ActionData {
  success?: boolean;
  brandId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

type Step = "confirm-store" | "brand-details" | "back-it-settings" | "done";

const STEPS: Step[] = ["confirm-store", "brand-details", "back-it-settings", "done"];

function stepProgress(step: Step): number {
  return ((STEPS.indexOf(step) + 1) / STEPS.length) * 100;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Multi-step brand onboarding wizard embedded in Shopify Admin.
 */
export default function OnboardingPage() {
  const { shop, shopName, existingBrandId } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();

  const [step, setStep] = useState<Step>(existingBrandId ? "back-it-settings" : "confirm-store");
  const [brandName, setBrandName] = useState(shopName ?? "");
  const [brandSlug, setBrandSlug] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [depositPercent, setDepositPercent] = useState("100");
  const [defaultMoq, setDefaultMoq] = useState("50");

  const currencyOptions = [
    { label: "AUD — Australian Dollar", value: "AUD" },
    { label: "USD — US Dollar", value: "USD" },
    { label: "GBP — British Pound", value: "GBP" },
    { label: "EUR — Euro", value: "EUR" },
  ];

  const depositOptions = [
    { label: "100% — Full payment upfront (recommended for v1)", value: "100" },
    { label: "50% — Half deposit, half on MOQ reached", value: "50" },
    { label: "30% — 30% deposit, remainder on MOQ reached", value: "30" },
  ];

  return (
    <Page
      title="Set up Back It"
      subtitle={`Connecting ${shop}`}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Progress indicator */}
            <ProgressBar progress={stepProgress(step)} />

            {/* Step: Confirm store */}
            {step === "confirm-store" && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Connected store
                  </Text>
                  <InlineStack gap="200" align="center">
                    <Badge tone="success">Connected</Badge>
                    <Text as="p" variant="bodyMd">
                      {shop}
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Back It will be installed on this store. Customers on your
                    storefront will see the "Back This Style" widget on eligible
                    product pages.
                  </Text>
                  <Button variant="primary" onClick={() => setStep("brand-details")}>
                    Continue
                  </Button>
                </BlockStack>
              </Card>
            )}

            {/* Step: Brand details */}
            {step === "brand-details" && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Brand details
                  </Text>
                  <TextField
                    label="Brand name"
                    value={brandName}
                    onChange={setBrandName}
                    autoComplete="off"
                    helpText="This is how your brand appears in Loocbooc."
                  />
                  <TextField
                    label="Brand URL slug"
                    value={brandSlug}
                    onChange={(v) => setBrandSlug(v.toLowerCase().replace(/\s+/g, "-"))}
                    autoComplete="off"
                    prefix="loocbooc.com/"
                    helpText="Used in campaign URLs. Lowercase letters, numbers, and hyphens only."
                  />
                  <InlineStack gap="300">
                    <Button onClick={() => setStep("confirm-store")}>Back</Button>
                    <Button
                      variant="primary"
                      disabled={!brandName || !brandSlug}
                      onClick={() => setStep("back-it-settings")}
                    >
                      Continue
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            {/* Step: Back It settings */}
            {step === "back-it-settings" && (
              <Form method="post">
                <input type="hidden" name="action" value="create-brand" />
                <input type="hidden" name="shop" value={shop} />
                <input type="hidden" name="brandName" value={brandName} />
                <input type="hidden" name="brandSlug" value={brandSlug} />
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Back It settings
                    </Text>
                    <Select
                      label="Store currency"
                      options={currencyOptions}
                      value={currency}
                      onChange={setCurrency}
                      name="currency"
                    />
                    <Select
                      label="Default deposit structure"
                      options={depositOptions}
                      value={depositPercent}
                      onChange={setDepositPercent}
                      name="depositPercent"
                      helpText="Can be overridden per campaign."
                    />
                    <TextField
                      label="Default minimum order quantity (MOQ)"
                      value={defaultMoq}
                      onChange={setDefaultMoq}
                      type="number"
                      name="defaultMoq"
                      helpText="The number of backers required before a campaign goes to production."
                      autoComplete="off"
                    />

                    {actionData?.error && (
                      <Banner tone="critical">
                        <p>{actionData.error}</p>
                      </Banner>
                    )}

                    <InlineStack gap="300">
                      <Button onClick={() => setStep("brand-details")}>Back</Button>
                      <Button variant="primary" submit>
                        Complete setup
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </Form>
            )}

            {/* Step: Done */}
            {(step === "done" || actionData?.success) && (
              <Card>
                <BlockStack gap="400">
                  <Banner tone="success">
                    <p>Back It is live on your store!</p>
                  </Banner>
                  <Text as="p" variant="bodyMd">
                    You're all set. Create your first campaign from the Back It
                    dashboard, then add the "Back It" block to your product
                    pages in the Theme Editor.
                  </Text>
                  <Button
                    variant="primary"
                    url="/shopify/campaigns"
                  >
                    Go to campaign dashboard
                  </Button>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
