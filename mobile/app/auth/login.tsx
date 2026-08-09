import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { Body, Display1, Eyebrow, Mono } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <IconButton name="arrow_back" onPress={() => router.back()} />
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} hitSlop={10}>
          <Mono color={C.textMuted}>SKIP FOR NOW</Mono>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: S.xl, paddingBottom: S.block }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>Welcome back</Eyebrow>
        <Display1 style={{ marginTop: 8 }}>Your kit,{"\n"}on every device.</Display1>
        <Body color={C.textMid} style={{ marginTop: 12 }}>
          Sign in to sync your pack, your orders and everything you&apos;ve saved.
        </Body>

        <Rule weight="ink" style={{ marginTop: S.xl }} />

        {err ? (
          <View style={s.errBox}>
            <Icon name="error" size={16} color={C.danger} />
            <Body color={C.danger} style={{ flex: 1 }}>
              {err}
            </Body>
          </View>
        ) : null}

        <View style={{ marginTop: S.xl }}>
          <Input
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setFieldErrs((p) => ({ ...p, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            err={fieldErrs.email}
          />
          <Input
            label="Password"
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              setFieldErrs((p) => ({ ...p, pw: undefined }));
            }}
            secureTextEntry
            err={fieldErrs.pw}
          />
        </View>

        <Button title="Sign in" loading={loading} onPress={handle} style={{ width: "100%" }} />

        <View style={s.switchRow}>
          <Text style={s.switchT}>New here?</Text>
          <Button title="Create an account" variant="link" onPress={() => router.push("/auth/signup")} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: S.gutter },
  errBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.danger12, borderRadius: R.panel, padding: 14, marginTop: S.lg },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: S.xl },
  switchT: { fontFamily: F.body, fontSize: 15, color: C.textMid },
});
