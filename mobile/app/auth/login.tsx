import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { afterAuth, goBack } from "@/lib/nav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { IconButton } from "@/components/ui/IconButton";
import { StatusCap } from "@/components/ui/StatusCap";
import { Topography } from "@/components/editorial/Topography";
import { Icon } from "@/components/ui/Icon";
import { Body } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { C, F, R, S } from "@/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  // Where the person was heading before they were asked to sign in.
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { signIn, resetPassword } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState<{ email?: string; pw?: string }>({});
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  // There was no recovery path in the app at all — a forgotten password meant
  // the account was simply unreachable from mobile. The email already typed
  // into the form is the one we send to, so this is one tap from being stuck.
  async function handleReset() {
    if (!EMAIL_RE.test(email.trim())) {
      setFieldErrs((p) => ({ ...p, email: "Enter your email first, then tap this again" }));
      haptics.warning();
      return;
    }
    setResetting(true);
    setErr("");
    const r = await resetPassword(email.trim());
    setResetting(false);
    if (r.error) {
      setErr(r.error);
      haptics.error();
      return;
    }
    haptics.success();
    // Deliberately does not confirm whether the address has an account — that
    // would turn this form into an email-enumeration oracle.
    toast.show("If that email has an account, a reset link is on its way");
  }

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
      afterAuth(next);
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusCap />

      {/* The ink panel, same as every other screen. This is the first surface a
          new customer ever sees, and it was the last one still on flat cream —
          so the app introduced itself in a voice it never used again. */}
      <View style={[s.panel, { paddingTop: insets.top + 10 }]}>
        <Topography
          width={SCREEN_W}
          height={300}
          color={C.sage}
          opacity={0.13}
          lines={9}
          seed={8.2}
          originX={0.84}
          originY={0.22}
        />
        <View style={s.top}>
          <IconButton
            name="arrow_back"
            tone="glass"
            accessibilityLabel="Back"
            onPress={() => goBack("/(tabs)/account")}
          />
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)")}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={s.skip}>SKIP FOR NOW</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.md }}>
          <Text style={s.panelEyebrow}>WELCOME BACK</Text>
          <Text style={s.panelTitle}>Your kit,{"\n"}on every device.</Text>
          <Text style={s.panelLede}>
            Sign in to sync your pack, your orders and everything you&apos;ve saved.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.block }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

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

        <TouchableOpacity
          onPress={handleReset}
          disabled={resetting}
          hitSlop={8}
          style={s.forgot}
          accessibilityRole="button"
        >
          <Text style={s.forgotT}>{resetting ? "Sending…" : "Forgot your password?"}</Text>
        </TouchableOpacity>

        <Button title="Sign in" loading={loading} onPress={handle} style={{ width: "100%" }} />

        <View style={s.switchRow}>
          <Text style={s.switchT}>New here?</Text>
          <Button title="Create an account" variant="link" onPress={() => router.push(next ? `/auth/signup?next=${encodeURIComponent(next)}` : "/auth/signup")} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  panel: {
    backgroundColor: C.ink,
    overflow: "hidden",
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
    marginBottom: S.block,
  },
  panelEyebrow: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.9, color: C.sage },
  panelTitle: { fontFamily: F.display, fontSize: 36, lineHeight: 39, letterSpacing: -0.2, color: C.paper, marginTop: 9 },
  panelLede: { fontFamily: F.body, fontSize: 15, lineHeight: 23, color: "rgba(251,247,239,0.7)", marginTop: 12 },
  skip: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: "rgba(251,247,239,0.6)" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: S.gutter },
  errBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.danger12, borderRadius: R.panel, padding: 14, marginTop: S.lg },
  forgot: { alignSelf: "flex-start", paddingVertical: S.xs, marginBottom: S.md },
  forgotT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.textMid },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: S.xl },
  switchT: { fontFamily: F.body, fontSize: 15, color: C.textMid },
});
