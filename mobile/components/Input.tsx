import { View, Text, TextInput, StyleSheet } from "react-native";
import { C, F } from "@/lib/theme";

type Props = { label:string; value:string; onChangeText:(v:string)=>void; secureTextEntry?:boolean; keyboardType?:"default"|"email-address"; autoCapitalize?:"none"|"words"|"sentences"; err?:string; placeholder?:string };

export function Input({ label, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, err, placeholder }:Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.lbl}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize} placeholder={placeholder} placeholderTextColor={C.light} style={[s.fld,err&&s.fldErr]}/>
      {err?<Text style={s.err}>{err}</Text>:null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom:24 },
  lbl: { fontFamily:F.displayBold,fontSize:10,letterSpacing:2.5,textTransform:"uppercase",color:C.forest,marginBottom:10 },
  fld: { fontFamily:F.body,fontSize:16,color:C.text,borderBottomWidth:1.5,borderBottomColor:C.rule,paddingBottom:12 },
  fldErr: { borderBottomColor:C.clay },
  err: { fontFamily:F.body,fontSize:12,color:C.clay,marginTop:6 },
});
