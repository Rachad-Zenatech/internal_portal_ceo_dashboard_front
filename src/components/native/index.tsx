import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type ViewProps,
  type TextProps,
  type PressableProps,
  type TextInputProps,
} from "react-native";
// RN's built-in SafeAreaView is deprecated; the community package is the replacement.
import { SafeAreaView } from "react-native-safe-area-context";

export {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
};

// ==========================================
// CARD COMPONENTS
// ==========================================
export interface NativeCardProps extends ViewProps {
  children?: React.ReactNode;
  style?: any;
}

export function NativeCard({ children, style, ...props }: NativeCardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

export interface NativeCardSubProps extends ViewProps {
  children?: React.ReactNode;
  style?: any;
}

export function NativeCardHeader({ children, style, ...props }: NativeCardSubProps) {
  return (
    <View style={[styles.cardHeader, style]} {...props}>
      {children}
    </View>
  );
}

export function NativeCardTitle({ children, style, ...props }: TextProps & { style?: any }) {
  return (
    <Text style={[styles.cardTitle, style]} {...props}>
      {children}
    </Text>
  );
}

export function NativeCardDescription({ children, style, ...props }: TextProps & { style?: any }) {
  return (
    <Text style={[styles.cardDescription, style]} {...props}>
      {children}
    </Text>
  );
}

export function NativeCardContent({ children, style, ...props }: NativeCardSubProps) {
  return (
    <View style={[styles.cardContent, style]} {...props}>
      {children}
    </View>
  );
}

export function NativeCardFooter({ children, style, ...props }: NativeCardSubProps) {
  return (
    <View style={[styles.cardFooter, style]} {...props}>
      {children}
    </View>
  );
}

// ==========================================
// BUTTON COMPONENT
// ==========================================
export type ButtonVariant = "default" | "secondary" | "outline" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface NativeButtonProps extends Omit<PressableProps, "style"> {
  title?: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: PressableProps["style"] | ViewProps["style"];
  textStyle?: TextProps["style"];
}

export function NativeButton({
  title,
  children,
  variant = "default",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  disabled,
  ...props
}: NativeButtonProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.btnSecondary;
      case "outline":
        return styles.btnOutline;
      case "destructive":
        return styles.btnDestructive;
      case "ghost":
        return styles.btnGhost;
      default:
        return styles.btnDefault;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm":
        return styles.btnSm;
      case "lg":
        return styles.btnLg;
      default:
        return styles.btnMd;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.btnTextSecondary;
      case "outline":
        return styles.btnTextOutline;
      case "destructive":
        return styles.btnTextDestructive;
      case "ghost":
        return styles.btnTextGhost;
      default:
        return styles.btnTextDefault;
    }
  };

  return (
    <Pressable
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.btnBase,
        getVariantStyle(),
        getSizeStyle(),
        (disabled || isLoading) && styles.btnDisabled,
        pressed && styles.btnPressed,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? "#2563eb" : "#ffffff"}
        />
      ) : (
        <View style={styles.btnContentRow}>
          {leftIcon && <View style={styles.iconMarginRight}>{leftIcon}</View>}
          {title ? <Text style={[styles.btnTextBase, getTextStyle(), textStyle]}>{title}</Text> : children}
          {rightIcon && <View style={styles.iconMarginLeft}>{rightIcon}</View>}
        </View>
      )}
    </Pressable>
  );
}

// ==========================================
// INPUT COMPONENT
// ==========================================
export interface NativeInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewProps["style"];
  style?: any;
}

export function NativeInput({
  label,
  error,
  containerStyle,
  style,
  ...props
}: NativeInputProps) {
  return (
    <View style={[styles.inputContainer, containerStyle]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        placeholderTextColor="#94a3b8"
        style={[
          styles.input,
          error ? styles.inputError : undefined,
          style,
        ]}
        {...props}
      />
      {error && <Text style={styles.inputErrorText}>{error}</Text>}
    </View>
  );
}

// ==========================================
// BADGE COMPONENT
// ==========================================
export type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export interface NativeBadgeProps extends ViewProps {
  label?: string;
  children?: React.ReactNode;
  variant?: BadgeVariant;
  leftIcon?: React.ReactNode;
  style?: any;
  textStyle?: TextProps["style"];
}

export function NativeBadge({
  label,
  children,
  variant = "default",
  leftIcon,
  style,
  textStyle,
  ...props
}: NativeBadgeProps) {
  const getBadgeStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.badgeSecondary;
      case "success":
        return styles.badgeSuccess;
      case "warning":
        return styles.badgeWarning;
      case "destructive":
        return styles.badgeDestructive;
      case "outline":
        return styles.badgeOutline;
      default:
        return styles.badgeDefault;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.badgeTextSecondary;
      case "success":
        return styles.badgeTextSuccess;
      case "warning":
        return styles.badgeTextWarning;
      case "destructive":
        return styles.badgeTextDestructive;
      case "outline":
        return styles.badgeTextOutline;
      default:
        return styles.badgeTextDefault;
    }
  };

  return (
    <View style={[styles.badgeBase, getBadgeStyle(), style]} {...props}>
      {label ? <Text style={[styles.badgeTextBase, getTextStyle(), textStyle]}>{label}</Text> : children}
    </View>
  );
}

// ==========================================
// TABLE COMPONENTS
// ==========================================
export function NativeTable({ children, style, ...props }: ViewProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.table, style]} {...props}>
        {children}
      </View>
    </ScrollView>
  );
}

export function NativeTableHeader({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.tableHeader, style]} {...props}>
      {children}
    </View>
  );
}

export function NativeTableBody({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.tableBody, style]} {...props}>
      {children}
    </View>
  );
}

export function NativeTableRow({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.tableRow, style]} {...props}>
      {children}
    </View>
  );
}

export function NativeTableHead({ children, style, textStyle, ...props }: ViewProps & { textStyle?: TextProps["style"] }) {
  return (
    <View style={[styles.tableHead, style]} {...props}>
      {typeof children === "string" ? (
        <Text style={[styles.tableHeadText, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function NativeTableCell({ children, style, textStyle, ...props }: ViewProps & { textStyle?: TextProps["style"] }) {
  return (
    <View style={[styles.tableCell, style]} {...props}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={[styles.tableCellText, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

// ==========================================
// STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    boxShadow: "0px 4px 16px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 20,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cardFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(241, 245, 249, 0.8)",
  },

  // Button
  btnBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnMd: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 46,
  },
  btnLg: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 52,
  },
  btnDefault: {
    backgroundColor: "#2563eb",
  },
  btnSecondary: {
    backgroundColor: "#f1f5f9",
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  btnDestructive: {
    backgroundColor: "#ef4444",
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  btnTextBase: {
    fontSize: 15,
    fontWeight: "600",
  },
  btnTextDefault: {
    color: "#ffffff",
  },
  btnTextSecondary: {
    color: "#1e293b",
  },
  btnTextOutline: {
    color: "#334155",
  },
  btnTextDestructive: {
    color: "#ffffff",
  },
  btnTextGhost: {
    color: "#2563eb",
  },
  iconMarginRight: {
    marginRight: 8,
  },
  iconMarginLeft: {
    marginLeft: 8,
  },

  // Input
  inputContainer: {
    marginBottom: 16,
    width: "100%",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    minHeight: 44,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  inputErrorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },

  // Badge
  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  badgeDefault: {
    backgroundColor: "#2563eb",
  },
  badgeSecondary: {
    backgroundColor: "#f1f5f9",
  },
  badgeSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  badgeWarning: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  badgeDestructive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  badgeOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  badgeTextBase: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextDefault: {
    color: "#ffffff",
  },
  badgeTextSecondary: {
    color: "#334155",
  },
  badgeTextSuccess: {
    color: "#16a34a",
  },
  badgeTextWarning: {
    color: "#ca8a04",
  },
  badgeTextDestructive: {
    color: "#dc2626",
  },
  badgeTextOutline: {
    color: "#475569",
  },

  // Table
  table: {
    width: "100%",
    minWidth: 600,
  },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableBody: {},
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    paddingVertical: 12,
  },
  tableHead: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  tableHeadText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  tableCellText: {
    fontSize: 14,
    color: "#1e293b",
  },
});
