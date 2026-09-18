import { z } from 'zod';

/**
 * The overlay document model.
 *
 * Geometry is stored in **PDF points** with the origin at the top-left of the
 * page as the member sees it. Zoom is purely a view concern, so a document
 * looks identical at any zoom level and the export maths stays trivial
 * (`pdfY = pageHeight - y - h`).
 */

export const ELEMENT_TYPES = [
  'text',
  'image',
  'rect',
  'ellipse',
  'line',
  'draw',
  'highlight',
  'check',
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

export const FONT_FAMILIES = ['sarabun', 'helvetica', 'times', 'courier'] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const FONT_LABELS: Record<FontFamily, string> = {
  sarabun: 'Sarabun (ไทย)',
  helvetica: 'Helvetica',
  times: 'Times',
  courier: 'Courier',
};

/** CSS stacks used while editing, chosen to match the exported PDF metrics. */
export const FONT_CSS: Record<FontFamily, string> = {
  sarabun: '"Sarabun", "Noto Sans Thai", system-ui, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'ต้องเป็นสีรูปแบบ #rrggbb');

const baseElement = {
  id: z.string().min(1).max(64),
  /** Index into `OverlayDoc.pages`. */
  page: z.number().int().min(0).max(5000),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().min(1).max(20000),
  h: z.number().finite().min(1).max(20000),
  rotation: z.number().finite().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  name: z.string().max(120).optional(),
};

export const textElementSchema = z.object({
  ...baseElement,
  type: z.literal('text'),
  text: z.string().max(20000).default(''),
  fontFamily: z.enum(FONT_FAMILIES).default('sarabun'),
  fontSize: z.number().min(4).max(400).default(16),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  color: hexColor.default('#111827'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  lineHeight: z.number().min(0.8).max(3).default(1.35),
  background: hexColor.nullable().default(null),
  padding: z.number().min(0).max(80).default(4),
});

export const imageElementSchema = z.object({
  ...baseElement,
  type: z.literal('image'),
  assetId: z.string().min(1).max(64),
  /** Natural aspect ratio, kept so "reset size" and shift-resize behave well. */
  naturalRatio: z.number().min(0.001).max(1000).default(1),
});

export const rectElementSchema = z.object({
  ...baseElement,
  type: z.literal('rect'),
  fill: hexColor.nullable().default('#e0e7ff'),
  stroke: hexColor.nullable().default('#4f46e5'),
  strokeWidth: z.number().min(0).max(40).default(1.5),
  radius: z.number().min(0).max(400).default(6),
});

export const ellipseElementSchema = z.object({
  ...baseElement,
  type: z.literal('ellipse'),
  fill: hexColor.nullable().default('#dcfce7'),
  stroke: hexColor.nullable().default('#16a34a'),
  strokeWidth: z.number().min(0).max(40).default(1.5),
});

export const lineElementSchema = z.object({
  ...baseElement,
  type: z.literal('line'),
  stroke: hexColor.default('#111827'),
  strokeWidth: z.number().min(0.2).max(40).default(2),
  arrowStart: z.boolean().default(false),
  arrowEnd: z.boolean().default(false),
  /** Endpoints as fractions of the bounding box, so resizing scales the line. */
  from: z.tuple([z.number(), z.number()]).default([0, 0]),
  to: z.tuple([z.number(), z.number()]).default([1, 1]),
});

export const drawElementSchema = z.object({
  ...baseElement,
  type: z.literal('draw'),
  /** Freehand strokes, each point a fraction of the bounding box. */
  strokes: z
    .array(z.array(z.tuple([z.number(), z.number()])).max(4000))
    .max(200)
    .default([]),
  stroke: hexColor.default('#1d4ed8'),
  strokeWidth: z.number().min(0.2).max(40).default(2),
});

export const highlightElementSchema = z.object({
  ...baseElement,
  type: z.literal('highlight'),
  color: hexColor.default('#fde047'),
});

export const checkElementSchema = z.object({
  ...baseElement,
  type: z.literal('check'),
  variant: z.enum(['check', 'cross', 'dot']).default('check'),
  color: hexColor.default('#16a34a'),
  strokeWidth: z.number().min(0.5).max(40).default(3),
});

export const elementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  imageElementSchema,
  rectElementSchema,
  ellipseElementSchema,
  lineElementSchema,
  drawElementSchema,
  highlightElementSchema,
  checkElementSchema,
]);

export const pageStateSchema = z.object({
  /** Index of the page inside the *original* uploaded PDF. */
  source: z.number().int().min(0).max(5000),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  hidden: z.boolean().default(false),
  /** Page box in points, after the PDF's own rotation is applied. */
  width: z.number().min(1).max(20000),
  height: z.number().min(1).max(20000),
});

export const overlaySchema = z.object({
  version: z.literal(1).default(1),
  pages: z.array(pageStateSchema).max(5000),
  /** Array order is the z-order: later elements paint on top. */
  elements: z.array(elementSchema).max(5000).default([]),
});

export type TextElement = z.infer<typeof textElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type RectElement = z.infer<typeof rectElementSchema>;
export type EllipseElement = z.infer<typeof ellipseElementSchema>;
export type LineElement = z.infer<typeof lineElementSchema>;
export type DrawElement = z.infer<typeof drawElementSchema>;
export type HighlightElement = z.infer<typeof highlightElementSchema>;
export type CheckElement = z.infer<typeof checkElementSchema>;
export type AnyElement = z.infer<typeof elementSchema>;
export type PageState = z.infer<typeof pageStateSchema>;
export type OverlayDoc = z.infer<typeof overlaySchema>;

export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: 'กล่องข้อความ',
  image: 'รูปภาพ',
  rect: 'สี่เหลี่ยม',
  ellipse: 'วงกลม',
  line: 'เส้น',
  draw: 'ลายเซ็น',
  highlight: 'ไฮไลต์',
  check: 'เครื่องหมาย',
};

export function elementLabel(element: AnyElement): string {
  if (element.name) return element.name;
  if (element.type === 'text') {
    const firstLine = element.text.split('\n')[0]?.trim();
    if (firstLine) return firstLine.slice(0, 32);
  }
  return ELEMENT_LABELS[element.type];
}
