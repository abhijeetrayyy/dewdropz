import { forwardRef, ReactNode } from "react";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { C } from "@/lib/theme";

type Props = { children: ReactNode; snapPoints?: (string | number)[]; onDismiss?: () => void };

// Thin themed wrapper around @gorhom/bottom-sheet's modal — used for
// filters/sort on Shop and the size guide on the product page. Callers hold
// a ref and call `.present()` / `.dismiss()`.
export const Sheet = forwardRef<BottomSheetModal, Props>(({ children, snapPoints = ["60%"], onDismiss }, ref) => (
  <BottomSheetModal
    ref={ref}
    snapPoints={snapPoints}
    onDismiss={onDismiss}
    backgroundStyle={{ backgroundColor: C.paper }}
    handleIndicatorStyle={{ backgroundColor: C.rule, width: 40, height: 5 }}
    backdropComponent={(props) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} pressBehavior="close" />
    )}
  >
    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
      {children}
    </BottomSheetScrollView>
  </BottomSheetModal>
));

Sheet.displayName = "Sheet";
