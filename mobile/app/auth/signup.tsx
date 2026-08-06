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

export default function SignUpScreen() {
  const { signUp } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [full, setFull] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState<{ full?: string; email?: string; pw?: string }>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handle() {
    const errs: typeof fieldErrs = {};
    if (!full.trim()) errs.full = "Required";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email";
    if (pw.length < 6) errs.pw = "At least 6 characters";
    setFieldErrs(errs);
    if (Object.keys(errs).length > 0) {
      haptics.warning();
      return;
    }
    setLoading(true);
    setErr("");
    const r = await signUp(email.trim(), pw, full.trim());
    setLoading(false);
    if (r.error) {
      setErr(r.error);
      haptics.error();
    } else {
      haptics.success();
      setSuccess(true);
    }
  }

  return (
    <View style={S.root}>
      <StatusBar style="light" />
      <View style={[S.band, { paddingTop: insets.top + 70 }]}>
        <Image source={LOGO_MARK} style={{ width: 52 * LOGO_ASPECT, height: 52, marginBottom: 14 }} contentFit="contain" />
        <Text style={S.brand}>DEWDROPZ</Text>
        <Text style={S.tag}>Join the expedition.</Text>
      </View>
      <KeyboardAvoidingView style={S.sheetWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={S.sheet} contentContainerStyle={{ padding: 24, paddingTop: 32 }} keyboardShouldPersistTaps="handled">
          {success ? (
            <View style={{ alignItems: "center", paddingTop: 20 }}>
              <Text style={S.sT}>✓ Check your email</Text>
              <Text style={S.sB}>We've sent a confirmation link. Verify your email to complete registration.</Text>
              <TouchableOpacity onPress={() => router.replace("/auth/login")}>
                <Text style={S.lnk}>Back to Sign In →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {err ? (
                <View style={S.ebox}>
                  <Text style={S.et}>{err}</Text>
                </View>
              ) : null}
              <Input label="Full Name" value={full} onChangeText={setFull} autoCapitalize="words" err={fieldErrs.full} />
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" err={fieldErrs.email} />
              <Input label="Password" value={pw} onChangeText={setPw} secureTextEntry err={fieldErrs.pw} />
              <Button title="Create Account" loading={loading} onPress={handle} />
              <TouchableOpacity onPress={() => router.replace("/auth/login")} style={{ marginTop: 28 }}>
                <Text style={S.sw}>
                  Already have an account? <Text style={S.swl}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
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
  sT: { fontFamily: F.displayItalic, fontSize: 22, color: C.forest, textAlign: "center", marginBottom: 14 },
  sB: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  lnk: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest },
  sw: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center" },
  swl: { fontFamily: F.bodyBold, color: C.forest },
});
