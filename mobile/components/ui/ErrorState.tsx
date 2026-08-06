import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { C, F } from "@/lib/theme";

type Props = { message?: string; onRetry?: () => void };

// Shared "something went wrong" layout used by every screen that fetches
// data — replaces the mismatched "pull to try again" copy that several
// screens showed without actually wiring a RefreshControl to back it up.
export function ErrorState({ message = "Something went wrong.", onRetry }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={onRetry}>
          <RefreshCw size={14} strokeWidth={2} color={C.forest} />
          <Text style={s.btnT}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 56 },
  title: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 21 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  btnT: { fontFamily: F.bodyBold, fontSize: 13, color: C.forest, letterSpacing: 0.4, fontWeight: "600" },
});
