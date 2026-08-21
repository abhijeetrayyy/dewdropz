import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import type { DesignLayer } from "@/lib/customize/types";
import { C, F, R } from "@/lib/theme";

const FONTS: { label: string; family: string }[] = [
  { label: "Sans", family: "Inter_400Regular" },
  { label: "Serif", family: "Fraunces_400Regular" },
  { label: "Mono", family: "SpaceMono_400Regular" },
];

// Print inks, not UI colours: these go on the garment, so they are a fixed
// physical palette rather than theme tokens.
const INKS = ["#FFFFFF", "#1A1A1A", "#27481F", "#7BA46F", "#B8826B", "#142536"];

// Renders exactly ONE panel, chosen by `mode`. The screen owns the tab bar and
// decides which is showing, mirroring the web studio: on a phone the canvas is
// the thing that must never be covered, so tools take turns instead of all
// stacking under the garment in a single scroll.
export function StudioToolbar({
  mode,
  selected,
  twoSided,
  activeSide,
  uploading,
  canUndo,
  canRedo,
  onAddText,
  onAddImage,
  onUndo,
  onRedo,
  onPatch,
  onDelete,
  onDuplicate,
  onReorder,
  onCopyToOtherSide,
  qualityNote,
  qualityTone,
}: {
  mode: "add" | "edit";
  selected: DesignLayer | null;
  twoSided: boolean;
  activeSide: "front" | "back";
  uploading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddText: () => void;
  onAddImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPatch: (patch: Partial<DesignLayer>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (dir: "up" | "down") => void;
  onCopyToOtherSide: () => void;
  /** Print-quality sentence for the selected image, or null. */
  qualityNote?: string | null;
  qualityTone?: "good" | "soft" | "poor" | null;
}) {
  const text = selected?.kind === "text" ? selected : null;

  return (
    <View style={s.root}>
      {mode === "add" && (
      <View style={s.addRow}>
        <TouchableOpacity style={s.addBtn} onPress={onAddText} activeOpacity={0.85}>
          <Icon name="title" size={16} color={C.forest} />
          <Text style={s.addT}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={onAddImage} disabled={uploading} activeOpacity={0.85}>
          <Icon name="add_photo_alternate" size={16} color={C.forest} />
          <Text style={s.addT}>{uploading ? "Adding…" : "Image"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.iconBtn, !canUndo && s.disabled]}
          onPress={onUndo}
          disabled={!canUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo"
        >
          <Icon name="undo" size={16} color={canUndo ? C.ink : C.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.iconBtn, !canRedo && s.disabled]}
          onPress={onRedo}
          disabled={!canRedo}
          accessibilityRole="button"
          accessibilityLabel="Redo"
        >
          <Icon name="redo" size={16} color={canRedo ? C.ink : C.textMuted} />
        </TouchableOpacity>
      </View>
      )}

      {mode === "add" && twoSided && (
        <TouchableOpacity style={s.copyRow} onPress={onCopyToOtherSide} activeOpacity={0.7}>
          <Icon name="flip" size={13} color={C.textMid} />
          <Text style={s.copyT}>Copy {activeSide} to {activeSide === "front" ? "back" : "front"}</Text>
        </TouchableOpacity>
      )}

      {mode === "add" && !selected ? (
        <Text style={s.hint}>
          Tap Text or Image to start. Pinch the garment to zoom in close.
        </Text>
      ) : null}

      {mode === "edit" && !selected ? (
        <Text style={s.hint}>Tap something on the garment to edit it.</Text>
      ) : null}

      {mode === "edit" && selected ? (
        <View style={s.panel}>
          {text ? (
            <>
              <TextInput
                value={text.text}
                onChangeText={(v) => onPatch({ text: v })}
                placeholder="Your text"
                placeholderTextColor={C.textMuted}
                style={s.input}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {FONTS.map((f) => (
                  <TouchableOpacity
                    key={f.family}
                    onPress={() => onPatch({ fontFamily: f.family })}
                    style={[s.chip, text.fontFamily === f.family && s.chipOn]}
                  >
                    <Text style={[s.chipT, { fontFamily: f.family }, text.fontFamily === f.family && s.chipTOn]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => onPatch({ bold: !text.bold })}
                  style={[s.chip, text.bold && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: text.bold }}
                  accessibilityLabel="Bold"
                >
                  <Icon name="format_bold" size={14} color={text.bold ? C.paper : C.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onPatch({ italic: !text.italic })}
                  style={[s.chip, text.italic && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: text.italic }}
                  accessibilityLabel="Italic"
                >
                  <Icon name="format_italic" size={14} color={text.italic ? C.paper : C.ink} />
                </TouchableOpacity>
              </ScrollView>

              <View style={s.sizeRow}>
                <Text style={s.lbl}>Size</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() => onPatch({ fontSize: Math.max(8, text.fontSize - 4) })}
                >
                  <Text style={s.stepT}>−</Text>
                </TouchableOpacity>
                <Text style={s.sizeV}>{Math.round(text.fontSize)}</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() => onPatch({ fontSize: Math.min(200, text.fontSize + 4) })}
                >
                  <Text style={s.stepT}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={s.chipRow}>
                {INKS.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => onPatch({ color: hex })}
                    style={[
                      s.ink,
                      { backgroundColor: hex },
                      text.color.toUpperCase() === hex && s.inkOn,
                    ]}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={s.hint}>Drag to move. Use the green corner to resize, the clay one to rotate. Pinch the garment to zoom.</Text>
              {/* HOW IT WILL ACTUALLY PRINT.
                  The studio read the picked photo's pixel dimensions to fit it
                  into the zone and then discarded them, so a 400px screenshot
                  stretched across a 12-inch front previewed perfectly and
                  printed at about 33 DPI with nothing said. It updates as the
                  image is resized, because resizing is the fix. */}
              {qualityNote ? (
                <View
                  style={[
                    s.quality,
                    qualityTone === "poor" && s.qualityPoor,
                    qualityTone === "soft" && s.qualitySoft,
                  ]}
                >
                  <Icon
                    name={qualityTone === "good" ? "check_circle" : "error"}
                    size={14}
                    color={qualityTone === "good" ? C.forest : qualityTone === "poor" ? C.clayDeep : C.ink}
                  />
                  <Text style={s.qualityT}>{qualityNote}</Text>
                </View>
              ) : null}
            </>
          )}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.act} onPress={() => onReorder("up")}>
              <Icon name="arrow_upward" size={14} color={C.ink} />
              <Text style={s.actT}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={() => onReorder("down")}>
              <Icon name="arrow_downward" size={14} color={C.ink} />
              <Text style={s.actT}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={onDuplicate}>
              <Icon name="content_copy" size={14} color={C.ink} />
              <Text style={s.actT}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={onDelete}>
              <Icon name="delete" size={14} color={C.clay} />
              <Text style={[s.actT, { color: C.clayDeep }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  quality: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: C.forest12,
  },
  qualitySoft: { backgroundColor: C.sand },
  qualityPoor: { backgroundColor: C.clay12 },
  qualityT: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.ink },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: C.ruleMed, borderRadius: R.pill, paddingVertical: 12, backgroundColor: C.paper,
  },
  addT: { fontFamily: F.bodyBold, fontSize: 13, color: C.forest },
  iconBtn: {
    width: 42, height: 42, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.ruleMed, borderRadius: R.panel, backgroundColor: C.paper,
  },
  disabled: { opacity: 0.45 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  copyT: { fontFamily: F.body, fontSize: 12, color: C.textMid },
  hint: { fontFamily: F.body, fontSize: 12, color: C.textMuted, lineHeight: 18 },
  panel: { gap: 12, borderTopWidth: 1, borderTopColor: C.ruleMed, paddingTop: 12 },
  input: {
    borderWidth: 1, borderColor: C.ruleMed, borderRadius: R.panel, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: F.body, fontSize: 15, color: C.ink, backgroundColor: C.paper,
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.ruleMed, backgroundColor: C.paper,
  },
  chipOn: { backgroundColor: C.forest, borderColor: C.forest },
  chipT: { fontSize: 13, color: C.ink },
  chipTOn: { color: C.paper },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lbl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.textMid },
  stepBtn: {
    width: 34, height: 34, borderRadius: R.pill, borderWidth: 1, borderColor: C.ruleMed,
    alignItems: "center", justifyContent: "center", backgroundColor: C.paper,
  },
  stepT: { fontFamily: F.body, fontSize: 18, color: C.ink, lineHeight: 20 },
  sizeV: { fontFamily: F.body, fontSize: 14, color: C.ink, width: 30, textAlign: "center" },
  ink: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.ruleMed },
  inkOn: { borderWidth: 2.5, borderColor: C.forest },
  actionRow: { flexDirection: "row", gap: 8 },
  act: {
    flex: 1, alignItems: "center", gap: 3, paddingVertical: 9,
    borderWidth: 1, borderColor: C.ruleMed, borderRadius: R.panel, backgroundColor: C.paper,
  },
  actT: { fontFamily: F.body, fontSize: 10, color: C.ink },
});
