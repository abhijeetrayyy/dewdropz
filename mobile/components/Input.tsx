import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardTypeOptions } from "react-native";
import { C, F, R } from "@/lib/theme";
import { Icon } from "@/components/ui/Icon";

// An underlined field, not a filled box. Filled inputs on a warm paper
// background read as pasted-on widgets; a rule that thickens and turns ink on
// focus keeps the form on the same page as the rest of the typography.
//
// The label is mono uppercase (matching section eyebrows) and the field itself
// is 17px — large enough that iOS won't zoom, and large enough to feel like
// the primary object on a checkout screen.

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  autoComplete?: "name" | "email" | "tel" | "postal-code" | "street-address" | "off";
  err?: string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
};

export function Input({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  err,
  hint,
  placeholder,
  maxLength,
  multiline,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const lineColor = err ? C.danger : focused ? C.ink : C.ruleMed;

  return (
    <View style={s.wrap}>
      <Text style={[s.lbl, err ? { color: C.danger } : focused ? { color: C.ink } : null]}>
        {label.toUpperCase()}
      </Text>

      <View style={s.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !reveal}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
          maxLength={maxLength}
          multiline={multiline}
          style={[s.fld, multiline && s.fldMulti]}
          selectionColor={C.forest}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setReveal((r) => !r)}
            hitSlop={12}
            style={s.reveal}
            accessibilityRole="button"
            accessibilityLabel={reveal ? "Hide password" : "Show password"}
          >
            <Icon name={reveal ? "visibility_off" : "visibility"} size={19} color={C.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Two stacked rules: a static hairline, and the active line drawn over
          it. Animating a color is cheaper and steadier than animating a
          border width, which reflows the field by a pixel on focus. */}
      <View style={s.track}>
        <View style={[s.line, { backgroundColor: lineColor, height: focused || err ? 1.5 : 1 }]} />
      </View>

      {err ? (
        <View style={s.msgRow}>
          <Icon name="error" size={14} color={C.danger} />
          <Text style={s.err}>{err}</Text>
        </View>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 22 },
  lbl: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.6, color: C.textMuted, marginBottom: 8 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fld: { flex: 1, fontFamily: F.body, fontSize: 17, color: C.ink, paddingVertical: 8, paddingHorizontal: 0 },
  fldMulti: { minHeight: 84, textAlignVertical: "top", paddingTop: 8 },
  reveal: { padding: 4 },
  track: { height: 1.5, justifyContent: "center", backgroundColor: C.ruleHair, borderRadius: R.tag },
  line: { width: "100%", borderRadius: R.tag },
  msgRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  err: { fontFamily: F.bodyMedium, fontSize: 12, color: C.danger },
  hint: { fontFamily: F.body, fontSize: 12, color: C.textMuted, marginTop: 7 },
});
