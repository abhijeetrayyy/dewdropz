import { StyleSheet, View, ViewStyle } from "react-native";
import { router, Href } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Display2, Body, Eyebrow } from "@/components/ui/Type";
import { Rule } from "@/components/editorial/Rule";
import { C, S } from "@/lib/theme";

// Empty states are a brand's most-read copy after the buy button, so they get
// the same furniture as a real section: mono eyebrow, rule, display headline.
// v4 set them in a centred column with a lone Bricolage line and a stranded
// green pill, which read as an error rather than an invitation.

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
}: Props) {
  return (
    <View style={[s.wrap, style]}>
      {icon ? (
        <View style={s.icon}>
          <Icon name={icon} size={26} color={C.textFaint} />
        </View>
      ) : null}

      <Eyebrow color={C.textMuted}>{eyebrow}</Eyebrow>
      <Rule weight="strong" style={{ marginTop: 9, alignSelf: "stretch" }} />
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
  icon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.ruleMed,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S.lg,
  },
});
