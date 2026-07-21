import { z } from "zod";

export const cupThingCategories = ["coffee", "wine", "dessert", "other"] as const;

export const cupThingCategorySchema = z.enum(cupThingCategories);

export type CupThingCategory = z.infer<typeof cupThingCategorySchema>;

export const cupThingFieldLimits = {
  displayName: 80,
  name: 120,
  location: 120,
  style: 120,
  notes: 2000,
  flavor: 40,
  flavors: 20
} as const;

const trimmedRequiredString = z
  .string()
  .trim()
  .min(1, "Required");

const optionalTrimmedString = (maxLength: number) => z
  .string()
  .trim()
  .max(maxLength)
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const ratingSchema = z
  .number()
  .min(1)
  .max(5)
  .refine((value) => Number.isInteger(value * 2), "Rating must use 0.5 steps");

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true });

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid id")
});

export const displayNameSchema = trimmedRequiredString.max(cupThingFieldLimits.displayName);

export const createProfileSchema = z.object({
  displayName: displayNameSchema
});

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const requestLoginSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema.optional()
});

export const verifyLoginSchema = z.object({
  token: z.string().trim().min(20).max(200)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(20).max(200).optional()
});

export const flavorsSchema = z
  .array(z.string().trim().min(1).max(cupThingFieldLimits.flavor))
  .max(cupThingFieldLimits.flavors)
  .default([]);

export const createCupThingSchema = z.object({
  name: trimmedRequiredString.max(cupThingFieldLimits.name),
  category: cupThingCategorySchema,
  consumedAt: isoDateTimeSchema,
  location: optionalTrimmedString(cupThingFieldLimits.location),
  style: optionalTrimmedString(cupThingFieldLimits.style),
  flavors: flavorsSchema,
  rating: ratingSchema.optional(),
  notes: optionalTrimmedString(cupThingFieldLimits.notes)
});

export const updateCupThingSchema = createCupThingSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export const cupThingListQuerySchema = z.object({
  category: cupThingCategorySchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional()
}).refine(
  (value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to),
  "from must be before or equal to to"
);

export const reviewQuerySchema = z.object({
  category: cupThingCategorySchema.optional(),
  from: isoDateTimeSchema,
  to: isoDateTimeSchema
}).refine(
  (value) => Date.parse(value.from) <= Date.parse(value.to),
  "from must be before or equal to to"
);

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type RequestLoginInput = z.infer<typeof requestLoginSchema>;
export type VerifyLoginInput = z.infer<typeof verifyLoginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateCupThingInput = z.infer<typeof createCupThingSchema>;
export type UpdateCupThingInput = z.infer<typeof updateCupThingSchema>;
export type CupThingListQuery = z.infer<typeof cupThingListQuerySchema>;
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;

export type Profile = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type CupThing = {
  id: string;
  name: string;
  category: CupThingCategory;
  consumedAt: string;
  location?: string;
  style?: string;
  flavors: string[];
  rating?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewStats = {
  totalCount: number;
  countByCategory: Record<CupThingCategory, number>;
  averageRating: number | null;
};

export type ReviewResponse = {
  records: CupThing[];
  stats: ReviewStats;
};
