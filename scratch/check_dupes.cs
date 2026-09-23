using System;
using System.IO;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        string[] lines = File.ReadAllLines(@"src\Lang.cs");
        Dictionary<string, int> itKeys = new Dictionary<string, int>();
        Dictionary<string, int> enKeys = new Dictionary<string, int>();

        bool isIt = true;
        int duplicatesCount = 0;

        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (line.Contains("_en = new Dictionary"))
            {
                isIt = false;
                continue;
            }

            if (line.StartsWith("{"))
            {
                int firstQuote = line.IndexOf('"');
                if (firstQuote != -1)
                {
                    int secondQuote = line.IndexOf('"', firstQuote + 1);
                    if (secondQuote != -1)
                    {
                        string key = line.Substring(firstQuote + 1, secondQuote - firstQuote - 1);
                        var targetDict = isIt ? itKeys : enKeys;
                        string dictName = isIt ? "IT (_it)" : "EN (_en)";

                        if (targetDict.ContainsKey(key))
                        {
                            Console.WriteLine("DUPLICATE KEY IN " + dictName + ": '" + key + "' at line " + (i + 1) + " (first seen at line " + targetDict[key] + ")");
                            duplicatesCount++;
                        }
                        else
                        {
                            targetDict[key] = i + 1;
                        }
                    }
                }
            }
        }

        Console.WriteLine("Total internal duplicates found: " + duplicatesCount);
    }
}
