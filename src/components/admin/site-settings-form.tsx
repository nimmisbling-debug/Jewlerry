"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { TextField, TextareaField } from "@/components/forms/text-field";
import { SwitchField } from "@/components/forms/select-field";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateSiteSettingsAction } from "@/lib/settings/actions";
import {
  siteSettingsFormSchema,
  type SiteSettingsFormInput,
  type SiteSettingsFormRawInput,
} from "@/lib/validations/admin";

export function SiteSettingsForm({ defaultValues }: { defaultValues: SiteSettingsFormRawInput }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SiteSettingsFormRawInput, unknown, SiteSettingsFormInput>({
    resolver: zodResolver(siteSettingsFormSchema),
    defaultValues,
  });

  async function onSubmit(values: SiteSettingsFormInput) {
    const result = await updateSiteSettingsAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Store settings saved.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FieldGroup>
        <TextField label="Store name" register={register("storeName")} error={errors.storeName} />
        <TextField label="Store email" type="email" register={register("storeEmail")} error={errors.storeEmail} />
        <TextField label="Store phone" register={register("storePhone")} error={errors.storePhone} />
        <TextField label="WhatsApp number" register={register("whatsappNumber")} error={errors.whatsappNumber} />
        <TextareaField label="Address" register={register("address")} error={errors.address} rows={2} />
        <TextareaField
          label="Business hours"
          register={register("businessHours")}
          error={errors.businessHours}
          rows={2}
        />
        <TextField
          label="Low stock threshold"
          type="number"
          step="1"
          register={register("lowStockThreshold")}
          error={errors.lowStockThreshold}
          description="Products at or below this quantity show a 'Low stock' badge."
        />
        <TextField
          label="Delivery fee (shipping cost)"
          type="number"
          step="0.01"
          register={register("shippingCost")}
          error={errors.shippingCost}
        />
        <TextField
          label="Currency code"
          register={register("currencyCode")}
          error={errors.currencyCode}
          maxLength={3}
          description="3-letter ISO code, e.g. PKR, USD."
        />
        <SwitchField
          name="darkModeEnabled"
          control={control}
          label="Allow dark mode"
          description="Turn off to force light mode across the storefront."
        />
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save store settings"}
      </Button>
    </form>
  );
}
