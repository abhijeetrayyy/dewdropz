import { ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { Icon } from "@/components/ui/Icon";
import { Body, Display2, Mono } from "@/components/ui/Type";
import { Topography } from "./Topography";
import { haptics } from "@/lib/haptics";
import { C, R, S } from "@/lib/theme";

/**
 * A full-bleed band that interrupts the page.
 *
 * The design rule this exists to serve: no screen may be one flat cream field.
 * The Shop was a single cream run from its header all the way to one ink block
 * at the very bottom — nothing reset the eye for two and a half screens, which
 * is what made a page with real photographs on it still read as dull.
 *
 * A band is also the only honest place to cross-sell between the business's
 * offerings. Shop never mentioned that we rent gear; the locker never mentioned
 * the studio. A band says it once, at full width, and gets out of the way.
 *
 * Tones match the header families, so a band pointing at the locker is the same
 * green as the locker's own header — the colour is a promise about where the
 * tap goes.
 */
type BandTone = "ink" | "forest" | "altitude";

const TONES: Record<BandTone, { ground: string; texture: string; eyebrow: string }> = {
  ink: { ground: C.ink, texture: C.sage, eyebrow: C.sage },
  forest: { ground: C.forestDeep, texture: C.sage, eyebrow: C.sage },
  altitude: { ground: C.altitude, texture: "#4C7FA8", eyebrow: C.sage },
};

export function SectionBand({
  eyebrow,
  title,
  body,
  actionLabel,
  onPress,
  image,
  icon,
  tone = "ink",
  right,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onPress?: () => void;
  /** Optional photograph, shown beside the copy. */
  image?: string;
  icon?: string;
  tone?: BandTone;
  right?: ReactNode;
}) {
  const t = TONES[tone];
  const { width } = useWindowDimensions();

  const inner = (
    <View style={[s.band, { backgroundColor: t.ground }]}>
      <Topography
        width={width}
        height={260}
        color={t.texture}
        opacity={0.16}
        lines={8}
        seed={4.1}
        originX={0.86}
        originY={0.3}
      />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Mono style={[s.eyebrow, { color: t.eyebrow }]}>{eyebrow.toUpperCase()}</Mono> : null}
          <Display2 color={C.paper} style={{ marginTop: 8 }}>{title}</Display2>
          {body ? (
            <Body color="rgba(251,247,239,0.74)" style={{ marginTop: 8, lineHeight: 22 }}>
              {body}
            </Body>
          ) : null}

          {actionLabel ? (
            <View style={s.action}>
              <Body color={C.paper} style={{ fontSize: 14 }}>{actionLabel}</Body>
              <Icon name="arrow_forward" size={17} color={C.paper} />
            </View>
          ) : null}
        </View>

        {image ? (
          <Image source={{ uri: image }} style={s.plate} contentFit="cover" transition={220} alt="" />
        ) : icon ? (
          <View style={s.disc}>
            <Icon name={icon} size={24} color={C.paper} />
          </View>
        ) : null}

        {right}
      </View>
    </View>
  );

  if (!onPress) return inner;
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${title}${actionLabel ? `. ${actionLabel}` : ""}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
    >
      {inner}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  band: { overflow: "hidden", paddingVertical: S.block, paddingHorizontal: S.gutter },
  row: { flexDirection: "row", alignItems: "center", gap: S.lg },
  eyebrow: { fontSize: 10, letterSpacing: 1.9 },
  action: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: S.lg },
  plate: { width: 96, height: 120, borderRadius: R.card, backgroundColor: "rgba(251,247,239,0.10)" },
  disc: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(251,247,239,0.14)",
  },
});
