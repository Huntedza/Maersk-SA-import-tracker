# SA Inbound Tracker - User Guide

## 🚢 **Getting Started**

The SA Inbound Tracker helps you monitor vessel schedules for imports to South African ports. Simply go to your domain URL and start exploring vessel schedules.

---

## 📋 **Main Interface**

### **Service Navigation Buttons**
The services are organized by priority (most-used first):

1. **SAECS Service** - Primary SA import service (11 vessels)
2. **MESAWA Service** - Middle East/West Africa route (10 vessels)  
3. **Safari Service** - Asia to SA route (11 vessels)
4. **Protea Service** - Middle East/India to SA (7 vessels)
5. **WAF7 Service** - West Africa route (5 vessels)
6. **WAFEX Service** - West Africa/Brazil route (6 vessels)
7. **American Express** - US East Coast to SA (10 vessels)
8. **Additional Services** - Other routes with SA arrivals

### **Vessel Grid Display**
- **Primary Grid**: Next 5 vessels arriving to SA
- **Extended Grid**: Following 5 vessels (when available)
- **Vessel Headers**: Show vessel name and voyage number
- **Port Columns**: Show departure ports in route order
- **Date Format**: DD MMM (e.g., "03 Aug", "15 Sep")

---

## 🔄 **Using the Refresh System**

### **Quick Refresh (Recommended)**
- **Click the "Refresh" button** - Gets latest data instantly (< 1 second)
- **Automatic updates** - System updates data every 30 minutes in background
- **Status indicators** - See when data was last updated

### **Force Refresh (When Needed)**
- **Click dropdown arrow** next to refresh button
- **Select "Force API Refresh"** - Gets absolutely latest data from Maersk (30-60 seconds)
- **Use sparingly** - Only when you need guaranteed latest information

### **Background Updates**
- **Automatic every 30 minutes** - No action needed
- **Silent updates** - Data refreshes without interrupting your work
- **Status notifications** - Small indicator shows when updating

---

## 📊 **Understanding the Data**

### **Vessel Information**
- **Vessel Name**: Ship name (e.g., "SANTA TERESA", "ONE R")
- **Voyage Number**: Service voyage (e.g., "252S", "536E")  
- **Service**: Which shipping line service
- **Route**: Departure ports → SA arrival ports

### **Port Abbreviations**
**South African Ports:**
- **ZACPT** = Cape Town
- **ZADUR** = Durban  
- **ZAPLZ** = Port Elizabeth

**Common Departure Ports:**
- **GBLGP** = London Gateway (UK)
- **NLRTM** = Rotterdam (Netherlands)
- **DEBRV** = Bremerhaven (Germany)
- **ESALG** = Algeciras (Spain)
- **AEJEA** = Jebel Ali (UAE)
- **CNSHA** = Shanghai (China)
- **MYTPP** = Tanjung Pelepas (Malaysia)

### **Date Interpretation**
- **Past dates** = Vessel has already departed that port
- **Future dates** = Scheduled departure/arrival
- **No date** = Information not available
- **Bold dates** = Next scheduled SA arrival

---

## 📱 **Features & Tips**

### **Excel Export**
- **Click "Export to Excel"** button
- **Downloads comprehensive data** for all vessels in current service
- **Includes all dates and port information**
- **Filename**: Automatically named with service and date

### **Dark Mode**
- **Default theme** - Easier on eyes for daily use
- **Automatic switching** - Remembers your preference
- **Professional appearance** - Clean, modern design

### **Responsive Design**
- **Works on desktop, tablet, mobile**
- **Adapts to screen size**
- **Touch-friendly on mobile devices**
- **Consistent experience across devices**

### **Service-Specific Features**
Each service shows ports in **actual route order**:
- **SAECS**: Europe → SA (London Gateway → Rotterdam → Bremerhaven → Algeciras → SA)
- **MESAWA**: Middle East → West Africa → SA  
- **Safari**: Asia → Indian Ocean → SA
- **Protea**: Middle East/India → SA
- **WAF7**: West Africa → SA
- **WAFEX**: Brazil → SA

---

## ⚡ **What's New & Improved**

### **Performance Improvements**
- **Instant refresh** - Was 30-60 seconds, now < 1 second
- **Background updates** - Automatic every 30 minutes
- **Faster loading** - Optimized for speed

### **Better Organization**
- **Priority ordering** - Most-used services first
- **Clean service list** - Removed irrelevant services
- **Logical grouping** - Services organized by usage

### **Fixed Issues**
- **SANTA CLARA bug fixed** - Vessels properly drop off after completion
- **Consistent data** - All services now show reliable information
- **Proper port ordering** - Ports show in actual shipping route order

### **User Experience**
- **Dark mode default** - Better for daily use
- **Improved navigation** - Clearer service labels
- **Better feedback** - Status indicators and timestamps
- **Mobile optimized** - Works great on all devices

---

## ❓ **Common Questions**

### **"Why don't I see a vessel that was there before?"**
Vessels automatically drop off the grid 5-7 days after completing their last South African port call. This keeps the display focused on upcoming arrivals.

### **"Why does refresh sometimes take longer?"**
- **Quick refresh** (< 1 second): Loads from cached data
- **Force refresh** (30-60 seconds): Gets latest data directly from Maersk API
- Use quick refresh for daily work, force refresh only when needed

### **"Can I see more than 10 vessels?"**
The system shows 5+5 vessels (10 total) per service to focus on the most immediate arrivals. This covers the next 2-3 months of arrivals for most services.

### **"What if a service doesn't show any vessels?"**
Only services with actual SA arrival data are displayed. If a service disappears, it means there are currently no scheduled arrivals to South African ports for that service.

### **"How often is the data updated?"**
- **Automatic updates**: Every 30 minutes
- **Manual refresh**: Instant from cache  
- **Force refresh**: Direct from Maersk API (latest possible data)

---

## 🛠️ **Troubleshooting**

### **Page Won't Load**
- Check internet connection
- Try refreshing the browser (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache if needed

### **Data Looks Outdated**
- Click the refresh button for latest cached data
- Use "Force API Refresh" dropdown option for guaranteed latest data
- Check the "Last updated" timestamp

### **Service Buttons Not Working**
- Allow page to fully load before clicking
- Try refreshing the browser
- Check if you're using a supported browser (Chrome, Firefox, Safari, Edge)

### **Excel Export Not Working**
- Ensure pop-ups are not blocked
- Try right-clicking and "Save As"
- Check Downloads folder

---

## 📞 **Getting Help**

### **For Daily Usage Questions:**
Contact your IT support team with specific details about what you're trying to do.

### **For Technical Issues:**
- Include screenshot if possible
- Note which service you were using
- Mention any error messages
- Include browser type (Chrome, Firefox, etc.)

### **For Data Accuracy Questions:**
Compare with official Maersk sources or contact your logistics team for verification.

---

## 🎯 **Best Practices**

### **Daily Workflow:**
1. **Start with SAECS or MESAWA** - Most commonly used services
2. **Use quick refresh** - Gets you latest cached data instantly  
3. **Export to Excel** when you need to share data
4. **Check multiple services** for comprehensive coverage

### **For Reporting:**
1. **Use Excel export** for comprehensive data
2. **Note the timestamp** when data was retrieved
3. **Force refresh** if you need guaranteed latest data
4. **Include service name** in your reports

### **For Planning:**
1. **Focus on Primary Grid** for immediate arrivals
2. **Check Extended Grid** for medium-term planning
3. **Monitor multiple services** for complete picture
4. **Set up regular checks** (system auto-updates, but manual review recommended)

**The SA Inbound Tracker is designed to make your vessel tracking efficient, accurate, and effortless. Enjoy the improved performance and features!**