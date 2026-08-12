import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  Type, ImagePlus, Trash2, Copy, Undo2, Redo2, Bold, Italic,
  ArrowUp, ArrowDown, FlipHorizontal2,
} from "lucide-react-native";
import type { DesignLayer } from "@/lib/customize/types";
import { C, F, R } from "@/lib/theme";

const FONTS: { label: string; family: string }[] = [
  { label: "Sans", family: "Inter_400Regular" },
  { label: "Serif", family: "Fraunces_400Regular" },
  { label: "Mono", family: "SpaceMono_400Regular" },
];

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
}) {
  const text = selected?.kind === "text" ? selected : null;

  return (
    <View style={s.root}>
      {mode === "add" && (
      <View style={s.addRow}>
        <TouchableOpacity style={s.addBtn} onPress={onAddText} activeOpacity={0.85}>
          <Type size={16} strokeWidth={1.75} color={C.forest} />
          <Text style={s.addT}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={onAddImage} disabled={uploading} activeOpacity={0.85}>
          <ImagePlus size={16} strokeWidth={1.75} color={C.forest} />
          <Text style={s.addT}>{uploading ? "Adding…" : "Image"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, !canUndo && s.disabled]} onPress={onUndo} disabled={!canUndo}>
          <Undo2 size={16} strokeWidth={1.75} color={canUndo ? C.text : C.light} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, !canRedo && s.disabled]} onPress={onRedo} disabled={!canRedo}>
          <Redo2 size={16} strokeWidth={1.75} color={canRedo ? C.text : C.light} />
        </TouchableOpacity>
      </View>
      )}

      {mode === "add" && twoSided && (
        <TouchableOpacity style={s.copyRow} onPress={onCopyToOtherSide} activeOpacity={0.7}>
          <FlipHorizontal2 size={13} strokeWidth={1.75} color={C.mid} />
          <Text style={s.copyT}>Copy {activeSide} to {activeSide === "front" ? "back" : "front"}</Text>
        </TouchableOpacity>
      )}

      {mode === "add" && !selected ? (
        <Text style={s.hint}>
          Tap Text or Image to start. Drag to move, pinch to resize, twist to rotate.
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
                placeholderTextColor={C.light}
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
                >
                  <Bold size={14} strokeWidth={2} color={text.bold ? "#FFFFFF" : C.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onPatch({ italic: !text.italic })}
                  style={[s.chip, text.italic && s.chipOn]}
                >
                  <Italic size={14} strokeWidth={2} color={text.italic ? "#FFFFFF" : C.text} />
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
            <Text style={s.hint}>Pinch to resize, twist to rotate, drag to move.</Text>
          )}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.act} onPress={() => onReorder("up")}>
              <ArrowUp size={14} strokeWidth={1.75} color={C.text} />
              <Text style={s.actT}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={() => onReorder("down")}>
              <ArrowDown size={14} strokeWidth={1.75} color={C.text} />
              <Text style={s.actT}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={onDuplicate}>
              <Copy size={14} strokeWidth={1.75} color={C.text} />
              <Text style={s.actT}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.act} onPress={onDelete}>
              <Trash2 size={14} strokeWidth={1.75} color={C.clay} />
              <Text style={[s.actT, { color: C.clay }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: C.rule, borderRadius: R.md, paddingVertical: 12, backgroundColor: C.surface,
  },
  addT: { fontFamily: F.bodyBold, fontSize: 13, color: C.forest },
  iconBtn: {
    width: 42, height: 42, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.rule, borderRadius: R.md, backgroundColor: C.surface,
  },
  disabled: { opacity: 0.45 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  copyT: { fontFamily: F.body, fontSize: 12, color: C.mid },
  hint: { fontFamily: F.body, fontSize: 12, color: C.light, lineHeight: 18 },
  panel: { gap: 12, borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 12 },
  input: {
    borderWidth: 1, borderColor: C.rule, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: F.body, fontSize: 15, color: C.text, backgroundColor: C.surface,
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.md,
    borderWidth: 1, borderColor: C.rule, backgroundColor: C.surface,
  },
  chipOn: { backgroundColor: C.forest, borderColor: C.forest },
  chipT: { fontSize: 13, color: C.text },
  chipTOn: { color: "#FFFFFF" },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lbl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.mid },
  stepBtn: {
    width: 34, height: 34, borderRadius: R.sm, borderWidth: 1, borderColor: C.rule,
    alignItems: "center", justifyContent: "center", backgroundColor: C.surface,
  },
  stepT: { fontFamily: F.body, fontSize: 18, color: C.text, lineHeight: 20 },
  sizeV: { fontFamily: F.body, fontSize: 14, color: C.text, width: 30, textAlign: "center" },
  ink: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.rule },
  inkOn: { borderWidth: 2.5, borderColor: C.forest },
  actionRow: { flexDirection: "row", gap: 8 },
  act: {
    flex: 1, alignItems: "center", gap: 3, paddingVertical: 9,
    borderWidth: 1, borderColor: C.rule, borderRadius: R.md, backgroundColor: C.surface,
  },
  actT: { fontFamily: F.body, fontSize: 10, color: C.text },
});
