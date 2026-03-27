package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ministry")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Ministry {
    @Id
    @Column(name = "ministry_key", unique = true, nullable = false, updatable = false)
    private String ministryKey;

    @Column(name = "name", nullable = false, unique = true)
    private String name;
}
