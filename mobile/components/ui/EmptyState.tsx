import { StyleSheet, View, ViewStyle } from "react-native";
import { router, Href } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Display2, Body, Eyebrow } from "@/components/ui/Type";
import { C, S } from "@/lib/theme";

// Empty states are a brand's most-read copy after the buy button, so they get
// the same furniture as a real section: mono eyebrow, rule, display headline.
// v4 set them in a centred column with a lone Bricolage line and a stranded
// green pill, which read as an error rather than an invitation.

/**
 * Ten screens have an empty state and every one of them looked identical:
 * a grey ringed circle, a rule, a display line, a button. That is fine once
 * and deadening ten times — and it is exactly the screens with nothing to show
 * that most need a reason to be looked at.
 *
 * `tone` ties the empty state to the screen's family (see ScreenHeader), so
 * an empty locker reads forest, an empty order list reads warm, and an empty
 * notifications list reads altitude. The disc fills rather than outlines,
 * which is what stops it looking like a placeholder.
 */
type EmptyTone = "neutral" | "warm" | "forest" | "altitude";

const TONE: Record<EmptyTone, { disc: string; glyph: string; rule: string }> = {
  neutral:  { disc: C.cream,               glyph: C.textMid,    rule: C.ruleMed },
  warm:     { disc: C.clay12,              glyph: C.clayDeep,   rule: "rgba(138,90,63,0.35)" },
  forest:   { disc: C.forest12,            glyph: C.forestDeep, rule: "rgba(27,51,21,0.30)" },
  altitude: { disc: "rgba(20,37,54,0.09)", glyph: C.altitude,   rule: "rgba(20,37,54,0.30)" },
};

type Props = {
  title: string;
  body?: string;
  eyebrow?: string;
  icon?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onPress?: () => void;
  /** Secondary text action under the primary CTA. */
  altLabel?: string;
  onAlt?: () => void;
  style?: ViewStyle;
  tone?: EmptyTone;
};

export function EmptyState({
  title,
  body,
  eyebrow = "Nothing here",
  icon,
  ctaLabel,
  ctaHref,
  onPress,
  altLabel,
  onAlt,
  style,
  tone = "neutral",
}: Props) {
  const t = TONE[tone];
  return (
    <View style={[s.wrap, style]}>
      {icon ? (
        <View style={[s.icon, { backgroundColor: t.disc }]}>
          <Icon name={icon} size={26} color={t.glyph} />
        </View>
      ) : null}

      <Eyebrow color={C.textMuted}>{eyebrow}</Eyebrow>
      <View style={[s.rule, { backgroundColor: t.rule }]} />
      <Display2 style={{ marginTop: S.md }}>{title}</Display2>
      {body ? (
        <Body color={C.textMid} style={{ marginTop: 10 }}>
          {body}
        </Body>
      ) : null}

      {ctaLabel ? (
        <Button
          title={ctaLabel}
          variant="dark"
          onPress={onPress ?? (() => ctaHref && router.push(ctaHref as Href))}
          style={{ marginTop: S.xl, alignSelf: "flex-start" }}
        />
      ) : null}
      {altLabel && onAlt ? <Button title={altLabel} variant="link" onPress={onAlt} style={{ marginTop: S.md }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  // Left-aligned, not centred: an empty state is a page of copy, and centred
  // ragged text is harder to read and looks like a dialog.
  wrap: { alignItems: "flex-start", paddingVertical: S.block },
  rule: { height: 1, alignSelf: "stretch", marginTop: 9 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S.lg,
  },
});
