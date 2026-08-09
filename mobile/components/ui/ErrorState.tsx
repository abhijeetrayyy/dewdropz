import { StyleSheet, View, ViewStyle } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Body, Eyebrow, Display3 } from "@/components/ui/Type";
import { Rule } from "@/components/editorial/Rule";
import { C, S } from "@/lib/theme";

// The "we couldn't load it" block. Deliberately quieter than EmptyState — a
// failed fetch is usually transient, so it gets a small headline and a retry
// rather than a full editorial spread that implies the screen is meant to be
// empty.

type Props = { message?: string; onRetry?: () => void; style?: ViewStyle };

export function ErrorState({ message = "Something went wrong.", onRetry, style }: Props) {
  return (
    <View style={[s.wrap, style]}>
      <View style={s.head}>
        <Icon name="cloud_off" size={17} color={C.danger} />
        <Eyebrow color={C.danger}>Couldn&apos;t load</Eyebrow>
      </View>
      <Rule weight="strong" style={{ marginTop: 9, alignSelf: "stretch" }} />
      <Display3 style={{ marginTop: S.md }}>{message}</Display3>
      <Body color={C.textMid} style={{ marginTop: 8 }}>
        Check your connection — the catalogue loads from our store in Dehradun.
      </Body>
      {onRetry ? <Button title="Try again" variant="quiet" size="md" icon="refresh" onPress={onRetry} style={{ marginTop: S.lg, alignSelf: "flex-start" }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "flex-start", paddingVertical: S.xxl },
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
});
