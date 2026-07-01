import { useEffect, useState } from "react";
import { supabase } from "./db";
import { useDiaAuth } from "./use-dia-auth";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Heart } from "lucide-react";

interface Props {
  contentType: "blog" | "podcast";
  contentId: string;
}

interface Row { user_id: string; reaction: "like" | "love"; }

export default function Reactions({ contentType, contentId }: Props) {
  const { user } = useDiaAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("dd_content_reactions")
      .select("user_id,reaction")
      .eq("content_type", contentType)
      .eq("content_id", contentId);
    setRows((data as any) ?? []);
  };

  useEffect(() => { load(); }, [contentId, contentType]);

  const toggle = async (reaction: "like" | "love") => {
    if (!user) return;
    const mine = rows.find((r) => r.user_id === user.id && r.reaction === reaction);
    if (mine) {
      await supabase.from("dd_content_reactions").delete()
        .eq("user_id", user.id).eq("content_type", contentType)
        .eq("content_id", contentId).eq("reaction", reaction);
    } else {
      await supabase.from("dd_content_reactions").insert({
        user_id: user.id, content_type: contentType, content_id: contentId, reaction,
      });
    }
    load();
  };

  const count = (k: "like" | "love") => rows.filter((r) => r.reaction === k).length;
  const mine = (k: "like" | "love") => !!user && rows.some((r) => r.user_id === user.id && r.reaction === k);

  return (
    <div className="flex gap-2 pt-1">
      <Button size="sm" variant={mine("like") ? "default" : "outline"} onClick={() => toggle("like")} className="rounded-full">
        <ThumbsUp className="h-4 w-4" /> {count("like")}
      </Button>
      <Button size="sm" variant={mine("love") ? "default" : "outline"} onClick={() => toggle("love")}
        className={`rounded-full ${mine("love") ? "bg-sublime-pink hover:bg-sublime-pink/90 text-white" : ""}`}>
        <Heart className={`h-4 w-4 ${mine("love") ? "fill-current" : ""}`} /> {count("love")}
      </Button>
    </div>
  );
}
