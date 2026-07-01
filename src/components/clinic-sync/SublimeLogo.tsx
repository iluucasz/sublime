import logo from "@/assets/sublime-logo.png";

export const SublimeLogo = ({ className = "h-10" }: { className?: string }) => (
  <img src={logo} alt="Sublime" className={className} />
);
