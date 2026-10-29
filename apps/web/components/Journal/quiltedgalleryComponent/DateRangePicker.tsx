import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/quilted-gallery/ui/card";
import { Label } from "@/components/ui/quilted-gallery/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/quilted-gallery/ui/popover";
import { Button } from "@/components/ui/button2";
import { Calendar } from "@/components/ui/quilted-gallery/ui/calendar";
import { CalendarIcon, Filter, X, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/utilities/context/ThemeContext";

function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
}: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  minDate: Date;
  maxDate: Date;
}) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  // Create proper theme-based styles using CSS custom properties
  const cardStyle = {
    borderColor: currentTheme.active,
    backdropFilter: 'blur(10px)'
  };

  const filterInfoStyle = {
    backgroundColor: `${currentTheme.light}b3`,
    borderColor: currentTheme.medium,
  };

  return (
    <>
      <Card 
        className="border-2 transition-all duration-200 hover:shadow-lg"
        style={cardStyle}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter 
              className="h-5 w-5" 
              style={{ color: currentTheme.primary }}
            />
            Filter by Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label 
                htmlFor="start-date" 
                className="text-sm font-medium"
              >
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="start-date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal transition-all duration-200 hover:shadow-md"
                  >
                    <CalendarIcon 
                      className="mr-2 h-4 w-4"
                      style={{ color: currentTheme.primary }}
                    />
                    {startDate ? format(startDate, "MMM dd, yyyy") : <span className="text-muted-foreground">Select start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 border rounded-lg shadow-xl" 
                  align="start"
                >
                  <div className="p-3 rounded-lg border" style={{ borderColor: currentTheme.medium }}>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => onStartDateChange(date)}
                      initialFocus
                      fromDate={minDate}
                      toDate={endDate || maxDate}
                      className="rounded-lg"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: isDarkMode ? "text-white text-sm font-medium" : "text-gray-900 text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: `h-7 w-7 bg-transparent p-0 text-sm ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'} rounded-md transition-colors`,
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: `text-xs w-9 font-normal ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`,
                        row: "flex w-full mt-2",
                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: `h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md transition-colors ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}`,
                        day_selected: `text-white hover:opacity-80 focus:text-white`,
                        day_today: `font-semibold`,
                        day_outside: isDarkMode ? "text-gray-600" : "text-gray-400",
                        day_disabled: isDarkMode ? "text-gray-600 opacity-50" : "text-gray-400 opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                      // Add custom styles for selected and today states
                      style={{
                        '--day-selected-bg': currentTheme.primary,
                        '--day-selected-hover-bg': currentTheme.hover,
                        '--day-today-bg': currentTheme.light,
                        '--day-today-color': currentTheme.primary,
                      } as React.CSSProperties}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex-1 space-y-2">
              <Label 
                htmlFor="end-date" 
                className="text-sm font-medium"
              >
                End Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal transition-all duration-200 hover:shadow-md"
                  >
                    <CalendarIcon 
                      className="mr-2 h-4 w-4"
                      style={{ color: currentTheme.primary }}
                    />
                    {endDate ? format(endDate, "MMM dd, yyyy") : <span className="text-muted-foreground">Select end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 border rounded-lg shadow-xl" 
                  align="end"
                >
                  <div className="p-3 rounded-lg border" style={{ borderColor: currentTheme.medium }}>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => onEndDateChange(date)}
                      initialFocus
                      fromDate={startDate || minDate}
                      toDate={maxDate}
                      className="rounded-lg"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: isDarkMode ? "text-white text-sm font-medium" : "text-gray-900 text-sm font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: `h-7 w-7 bg-transparent p-0 text-sm ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'} rounded-md transition-colors`,
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: `text-xs w-9 font-normal ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`,
                        row: "flex w-full mt-2",
                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: `h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md transition-colors ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}`,
                        day_selected: `text-white hover:opacity-80 focus:text-white`,
                        day_today: `font-semibold`,
                        day_outside: isDarkMode ? "text-gray-600" : "text-gray-400",
                        day_disabled: isDarkMode ? "text-gray-600 opacity-50" : "text-gray-400 opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                      style={{
                        '--day-selected-bg': currentTheme.primary,
                        '--day-selected-hover-bg': currentTheme.hover,
                        '--day-today-bg': currentTheme.light,
                        '--day-today-color': currentTheme.primary,
                      } as React.CSSProperties}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {(startDate || endDate) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 px-3 transition-all duration-200 rounded-lg"
                  style={{
                    color: '#dc2626',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(220, 38, 38, 0.15)' : 'rgba(254, 242, 242, 1)';
                    e.currentTarget.style.color = '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  onClick={() => {
                    onStartDateChange(undefined);
                    onEndDateChange(undefined);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}
          </div>
          
          {(startDate || endDate) && (
            <div 
              className="mt-4 p-3 rounded-lg border transition-all duration-200 bg-muted"
              style={{ borderColor: currentTheme.medium }}
            >
              <p className="text-sm">
                {startDate && endDate ? (
                  <>
                    Showing photos from <strong style={{ color: currentTheme.primary }}>{format(startDate, "MMM dd, yyyy")}</strong> to <strong style={{ color: currentTheme.primary }}>{format(endDate, "MMM dd, yyyy")}</strong>
                  </>
                ) : startDate ? (
                  <>
                    Showing photos from <strong style={{ color: currentTheme.primary }}>{format(startDate, "MMM dd, yyyy")}</strong> onwards
                  </>
                ) : endDate ? (
                  <>
                    Showing photos up to <strong style={{ color: currentTheme.primary }}>{format(endDate, "MMM dd, yyyy")}</strong>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add CSS to handle calendar day states */}
      <style jsx>{`
        .calendar-day-selected {
          background-color: ${currentTheme.primary} !important;
          color: white !important;
        }
        .calendar-day-selected:hover {
          background-color: ${currentTheme.hover} !important;
        }
        .calendar-day-today {
          background-color: ${currentTheme.light} !important;
          color: ${currentTheme.primary} !important;
        }
      `}</style>
    </>
  );
}

export default DateRangePicker;