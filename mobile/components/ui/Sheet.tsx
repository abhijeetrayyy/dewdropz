import { forwardRef, ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Icon } from "./Icon";
import { Display2, Eyebrow } from "./Type";
import { Rule } from "@/components/editorial/Rule";
import { C, R, S } from "@/lib/theme";

// Themed wrapper around @gorhom/bottom-sheet. v4's version handed every caller
// a bare scroll view, so each sheet re-implemented its own title row and they
// drifted apart (the filter sheet had a "Reset" text link, the size guide had
// a circular close button, at different heights).
//
// The header is built in here now: eyebrow, display title, close button, rule.
// Callers pass `title`/`eyebrow` and get the same sheet furniture every time.

type Props = {
  children: ReactNode;
  snapPoints?: (string | number)[];
  title?: string;
  eyebrow?: string;
  onDismiss?: () => void;
  onClose?: () => void;
};

export const Sheet = forwardRef<BottomSheetModal, Props>(
  ({ children, snapPoints = ["62%"], title, eyebrow, onDismiss, onClose }, ref) => (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onDismiss}
      backgroundStyle={s.bg}
      handleIndicatorStyle={s.handle}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.42} pressBehavior="close" />
      )}
    >
      <BottomSheetScrollView contentContainerStyle={s.content}>
        {title ? (
          <View style={{ marginBottom: S.lg }}>
            <View style={s.headRow}>
              <View style={{ flex: 1 }}>
                {eyebrow ? <Eyebrow style={{ marginBottom: 7 }}>{eyebrow}</Eyebrow> : null}
                <Display2>{title}</Display2>
              </View>
              <TouchableOpacity
                onPress={() => onClose?.() ?? (ref as any)?.current?.dismiss()}
                hitSlop={12}
                style={s.close}
                accessibilityLabel="Close"
              >
                <Icon name="close" size={19} color={C.ink} />
              </TouchableOpacity>
            </View>
            <Rule weight="strong" style={{ marginTop: S.md }} />
          </View>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  ),
);

Sheet.displayName = "Sheet";

const s = StyleSheet.create({
  bg: { backgroundColor: C.paper, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet },
  handle: { backgroundColor: C.ruleStrong, width: 34, height: 4 },
  content: { paddingHorizontal: S.gutter, paddingTop: S.xs, paddingBottom: 44 },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md },
  close: { width: 34, height: 34, borderRadius: 999, borderWidth: 1, borderColor: C.ruleMed, alignItems: "center", justifyContent: "center" },
});
