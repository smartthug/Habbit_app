"use client";

import { useState, useRef, useEffect } from "react";
import { Camera } from "lucide-react";

interface ProfilePictureProps {
  name: string;
  profilePicture?: string;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onPictureChange?: (base64: string) => void;
  className?: string;
}

export default function ProfilePicture({
  name,
  profilePicture,
  size = "md",
  editable = false,
  onPictureChange,
  className = "",
}: ProfilePictureProps) {
  const [preview, setPreview] = useState<string | undefined>(profilePicture);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with profilePicture prop when it changes
  useEffect(() => {
    console.log("[PROFILE PICTURE] Prop changed, profilePicture exists:", !!profilePicture);
    if (profilePicture) {
      console.log("[PROFILE PICTURE] Profile picture length:", profilePicture.length);
      console.log("[PROFILE PICTURE] Profile picture preview:", profilePicture.substring(0, 50) + "...");
    }
    setPreview(profilePicture);
  }, [profilePicture]);

  const sizeClasses = {
    sm: "w-16 h-16 text-lg",
    md: "w-24 h-24 text-2xl",
    lg: "w-32 h-32 text-3xl",
    xl: "w-40 h-40 text-4xl",
  };

  const initial = name
    ? name
        .trim()
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreview(base64String);
      if (onPictureChange) {
        onPictureChange(base64String);
      }
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  function handleClick() {
    if (editable && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-lg cursor-pointer transition-all duration-200 ${
          editable ? "hover:opacity-80 active:scale-95" : ""
        } ${
          preview
            ? "bg-gradient-to-br from-indigo-500 to-purple-600"
            : "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600"
        }`}
        onClick={handleClick}
      >
        {preview ? (
          <img
            src={preview}
            alt={name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="absolute bottom-0 right-0 bg-indigo-600 dark:bg-indigo-500 rounded-full p-2 shadow-lg border-2 border-white dark:border-slate-800">
            <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
        </>
      )}
    </div>
  );
}
