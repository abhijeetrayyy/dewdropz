import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { haptics } from "@/lib/haptics";
import { C, F, R } from "@/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_MARK = require("@/assets/images/logo-mark.png");
const LOGO_ASPECT = 1425 / 820;

export default function LoginScreen() {
  const { signIn } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState<{ email?: string; pw?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handle() {
    const errs: typeof fieldErrs = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email";
    if (!pw) errs.pw = "Required";
    setFieldErrs(errs);
    if (Object.keys(errs).length > 0) {
      haptics.warning();
      return;
    }
    setLoading(true);
    setErr("");
    const r = await signIn(email.trim(), pw);
    setLoading(false);
    if (r.error) {
      setErr(r.error);
      haptics.error();
    } else {
      haptics.success();
      router.back();
    }
  }

  return (
    <View style={S.root}>
      <StatusBar style="light" />
      <View style={[S.band, { paddingTop: insets.top + 70 }]}>
        <Image source={LOGO_MARK} style={{ width: 52 * LOGO_ASPECT, height: 52, marginBottom: 14 }} contentFit="contain" />
        <Text style={S.brand}>DEWDROPZ</Text>
        <Text style={S.tag}>Welcome back to basecamp.</Text>
      </View>
      <KeyboardAvoidingView style={S.sheetWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={S.sheet} contentContainerStyle={{ padding: 24, paddingTop: 32 }} keyboardShouldPersistTaps="handled">
          {err ? (
            <View style={S.ebox}>
              <Text style={S.et}>{err}</Text>
            </View>
          ) : null}
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" err={fieldErrs.email} />
          <Input label="Password" value={pw} onChangeText={setPw} secureTextEntry err={fieldErrs.pw} />
          <Button title="Sign In" loading={loading} onPress={handle} />
          <TouchableOpacity onPress={() => router.push("/auth/signup")} style={{ marginTop: 28 }}>
            <Text style={S.sw}>
              Don't have an account? <Text style={S.swl}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.forest },
  band: { alignItems: "center", paddingBottom: 44, paddingHorizontal: 24 },
  brand: { fontFamily: F.display, fontSize: 30, color: C.paper, letterSpacing: 3, textTransform: "uppercase" },
  tag: { fontFamily: F.body, fontSize: 14, color: C.paper + "CC", marginTop: 8 },
  sheetWrap: { flex: 1 },
  sheet: { flex: 1, backgroundColor: C.paper, borderTopLeftRadius: R.md + 12, borderTopRightRadius: R.md + 12 },
  ebox: { backgroundColor: C.clay + "14", borderWidth: 1, borderColor: C.clay + "26", borderRadius: 12, padding: 14, marginBottom: 20 },
  et: { fontFamily: F.body, fontSize: 13, color: C.clay, textAlign: "center" },
  sw: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center" },
  swl: { fontFamily: F.bodyBold, color: C.forest },
});
