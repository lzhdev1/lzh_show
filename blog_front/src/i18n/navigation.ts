import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// 语言感知的导航工具：Link / redirect / useRouter / usePathname / getPathname
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
